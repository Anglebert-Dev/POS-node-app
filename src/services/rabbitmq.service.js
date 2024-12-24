const amqp = require("amqplib");
const config = require("../config");
const logger = require("./logger.service");

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    console.log(config.rabbitmq.url);
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      this.connection.on("close", () => {
        logger.error("RabbitMQ connection closed. Reconnecting...");
        setTimeout(() => this.connect(), 5000);
      });

      logger.info("RabbitMQ connection established");

      return this.channel;
    } catch (error) {
      // throw new PrintError('RabbitMQ connection failed', true);
      logger.error("RabbitMQ connection failed", error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async setupQueue(queueName) {

    if (!this.channel) {
      throw new Error('No RabbitMQ channel available');
    }
    try {
      await this.channel.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: "dead-letter-exchange",
        messageTtl: 24 * 60 * 60 * 1000,
      });
      await this.channel.prefetch(1);
      logger.info(`Queue ${queueName} setup complete`);
    } catch (error) {
      // throw new PrintError(`Queue ${queueName} creation failed`, true);
      logger.error(`Queue ${queueName} creation failed`, error);
      throw error;
    }
  }

  async consume(queueName, callback) {
    try {
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            await callback(msg);
          } catch (error) {
            logger.error("Error processing message:", error);
            this.channel.nack(msg, false, error.isRetryable);
          }
        }
      });
      logger.info(`Started consuming from queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to start consuming from ${queueName}:`, error);
      throw error;
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      logger.info("RabbitMQ connection closed gracefully");
    } catch (error) {
      logger.error("Error closing RabbitMQ connection:", error);
      throw error;
    }
  }
}


module.exports = new RabbitMQService();