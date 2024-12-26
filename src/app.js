const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const config = require("./config");
const healthRoutes = require("./routes/health.routes");
const errorMiddleware = require("./middleware/error.middleware");
const loggerMiddleware = require("./middleware/logger.middleware");
const rabbitMQService = require("./services/rabbitmq.service");
const printerService = require("./services/printer.service");
const notificationService = require("./services/notification.service");
const PrintJob = require("./models/print-job.model");
const fs = require("fs");
const path = require("path");

class PrintApp {
  constructor() {
    if (!config.businessId) {
      throw new Error("Business_ID environment variable must be set");
    }

    this.queueName = `${config.queuePrefix}${config.businessId}`;
    this.printJobsDir = path.join(__dirname, "printJobs");
    this.app = express();

    this.setupExpress();
    this.setupRoutes();
  }

  setupExpress() {
    // Add request ID middleware for error tracking
    this.app.use((req, res, next) => {
      req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(loggerMiddleware);
  }

  setupRoutes() {
    this.app.use("/health", healthRoutes);

    // Error handling should be the last middleware
    this.app.use(errorMiddleware);

    // Catch-all for unhandled routes
    this.app.use((req, res, next) => {
      const error = new Error("Not Found");
      error.statusCode = 404;
      next(error);
    });
  }

  ensurePrintJobsDirectory() {
    if (!fs.existsSync(this.printJobsDir)) {
      fs.mkdirSync(this.printJobsDir);
    }
  }

  async savePrintJobToFile(
    printerId,
    content,
    extension = "pdf",
    metadata = {}
  ) {
    const baseFileName = metadata.fileName || `${printerId}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Check if file already exists (without timestamp)
    const files = fs.readdirSync(this.printJobsDir);
    const existingFile = files.find((file) => {
      // Remove timestamp portion from existing files for comparison
      const existingBaseName = file.split("_20")[0]; // Split at timestamp prefix
      return existingBaseName === baseFileName;
    });

    if (existingFile) {
      notificationService.logSystemNotification("Print Job Duplicate", {
        fileName: existingFile,
        printerId,
        metadata,
      });
      // Return the path of existing file
      return path.join(this.printJobsDir, existingFile);
    }

    // If file doesn't exist, save with timestamp
    const fileName = `${baseFileName}_${timestamp}.${extension}`;
    const filePath = path.join(this.printJobsDir, fileName);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, (err) => {
        if (err) {
          const error = new Error(`Failed to save print job: ${err.message}`);
          notificationService.logSystemNotification("File Save Error", {
            error: error.message,
            printerId,
            filePath,
            metadata,
            stack: error.stack,
          });
          reject(error);
        } else {
          notificationService.logSystemNotification("File Save Success", {
            fileName,
            printerId,
            metadata,
          });
          resolve(filePath);
        }
      });
    });
  }

  async start() {
    try {
      await rabbitMQService.connect();
      await rabbitMQService.setupQueue(this.queueName);

      await rabbitMQService.consume(
        this.queueName,
        async ({ content, properties }) => {
          try {
            let filePath;

            if (properties.contentType === "application/pdf") {
              filePath = await this.savePrintJobToFile(
                properties.headers.printerId,
                content,
                "pdf",
                properties.headers
              );
              await printerService.print(
                properties.headers.printerId,
                content,
                properties.headers
              );
            } else {
              const pdfBuffer = Buffer.from(content.content, "base64");
              filePath = await this.savePrintJobToFile(
                content.printerId,
                pdfBuffer
              );
              await printerService.print(
                content.printerId,
                pdfBuffer,
                content.metadata
              );
            }

            notificationService.logSystemNotification("Print Job Success", {
              filePath,
              printerId: properties.headers.printerId || content.printerId,
            });
          } catch (error) {
            notificationService.logPrintError(error, {
              printerId: properties.headers?.printerId || content?.printerId,
              isRetryable: true,
            });
            throw error;
          }
        }
      );

      this.app.listen(config.port, () => {
        notificationService.logSystemNotification(`Print service started`, {
          businessId: config.businessId,
          port: config.port,
        });
      });
    } catch (error) {
      notificationService.logSystemNotification("Print Service Start Failed", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  async stop() {
    try {
      await rabbitMQService.close();
      notificationService.logSystemNotification("Print service stopped");
    } catch (error) {
      notificationService.logSystemNotification("Print Service Stop Failed", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }
}

module.exports = PrintApp;
