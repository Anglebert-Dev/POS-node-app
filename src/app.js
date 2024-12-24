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

 
  async start() {
    try {
      await rabbitMQService.connect();
      await rabbitMQService.setupQueue(this.queueName);

      // MODIFIED: Updated consume callback to handle both PDF and JSON messages
      await rabbitMQService.consume(this.queueName, async ({ content, properties }) => {
        try {
          // ADDED: Content type handling logic
          if (properties.contentType === 'application/pdf') {
            // ADDED: Direct PDF handling
            await printerService.print(
              properties.headers.printerId,
              content,
              properties.headers
            );
          } else {
            // ADDED: JSON message handling
            if (content.businessId !== config.businessId) {
              logger.error(`Received print job for wrong business: ${content.businessId}`);
              return;
            }

            const pdfBuffer = Buffer.from(content.content, 'base64');
            await printerService.print(
              content.printerId,
              pdfBuffer,
              content.metadata
            );
          }

          // MODIFIED: Updated log message to handle both message types
          logger.info(`Print job completed for printer: ${properties.headers.printerId || content.printerId}`);
        } catch (error) {
          logger.error(`Print job failed: ${error.message}`);
          throw error;
        }
      });

      this.app.listen(config.port, () => {
        logger.info(`Print service for ${config.businessId} running on port ${config.port}`);
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
