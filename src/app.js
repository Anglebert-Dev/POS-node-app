const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const config = require("./config");
const healthRoutes = require("./routes/health.routes");
const errorMiddleware = require("./middleware/error.middleware");
const loggerMiddleware = require("./middleware/logger.middleware");
const rabbitMQService = require("./services/rabbitmq.service");
const printerService = require("./services/printer.service");
const logger = require("./services/logger.service");
const PrintJob = require("./models/print-job.model");
const dotenv = require("dotenv").config();
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
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(loggerMiddleware);
  }

  setupRoutes() {
    this.app.use("/health", healthRoutes);
    // this.app.use(errorMiddleware);
  }

  // Ensure the printJobs directory exists
  ensurePrintJobsDirectory() {
    if (!fs.existsSync(this.printJobsDir)) {
      fs.mkdirSync(this.printJobsDir);
    }
  }

  // Save the print job to a file
  async savePrintJobToFile(printerId, content, extension = "pdf") {
    const timestamp = Date.now();
    const fileName = `${printerId}_${timestamp}.${extension}`;
    const filePath = path.join(this.printJobsDir, fileName);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, (err) => {
        if (err) {
          reject(new Error(`Failed to save print job: ${err.message}`));
        } else {
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
              // Save PDF file before printing
              filePath = await this.savePrintJobToFile(
                properties.headers.printerId,
                content
              );
              await printerService.print(
                properties.headers.printerId,
                content,
                properties.headers
              );
            } else {
              // Save base64 content as PDF before printing
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

            logger.info(`Print job saved at ${filePath}`);
            logger.info(
              `Print job completed for printer: ${
                properties.headers.printerId || content.printerId
              }`
            );
          } catch (error) {
            logger.error(`Print job failed: ${error.message}`);
            throw error;
          }
        }
      );

      this.app.listen(config.port, () => {
        logger.info(
          `Print service for ${config.businessId} running on port ${config.port}`
        );
      });
    } catch (error) {
      logger.error(`Failed to start print service: ${error.message}`);
      process.exit(1);
    }
  }

  async stop() {
    try {
      await rabbitMQService.close();
      logger.info("Print service stopped");
    } catch (error) {
      logger.error(`Failed to stop print service: ${error.message}`);
      process.exit(1);
    }
  }
}

module.exports = PrintApp;
