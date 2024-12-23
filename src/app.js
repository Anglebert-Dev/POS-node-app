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
    // this.app.use(errorMiddleware);
  }

  setupRoutes() {
    this.app.use("/health", healthRoutes);
    this.app.use(errorMiddleware);
  }

  async start() {
    try {
      await rabbitMQService.connect();
      await rabbitMQService.setupQueue(this.queueName);

      await rabbitMQService.consume(this.queueName, async (msg) => {
        try {
          const printJob = new PrintJob(msg.content);

          if (printJob.businessId !== config.businessId) {
            logger.error(
              `Received print job for wrong business: ${printJob.businessId}`
            );
            rabbitMQService.channel.nack(msg, false, false);
            return;
          }

          await printerService.print(
            printJob.printerId,
            printJob.getPDFBuffer(),
            printJob.metadata
          );

          rabbitMQService.channel.ack(msg);
          logger.info(`Print job completed: ${printJob.metadata.fileName}`);
        } catch (error) {
          logger.error(`Print job failed: ${error.message}`);
          rabbitMQService.channel.nack(msg, false, error.isRetryable);
        }
      });

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
