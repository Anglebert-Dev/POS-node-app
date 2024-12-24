// rabbitmq.service.js
const amqp = require("amqplib");
const config = require("../config");
const logger = require("./logger.service");

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
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
      logger.error("RabbitMQ connection failed", error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async setupQueue(queueName) {
    if (!this.channel) {
      throw new Error("No RabbitMQ channel available");
    }

    try {
      // Consumer creates the queue with all needed properties
      await this.channel.assertQueue(queueName, {
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "dead-letter-exchange",
          "x-message-ttl": 24 * 60 * 60 * 1000, // 24 hours
        },
      });

      // Set up dead letter exchange
      // await this.channel.assertExchange("dead-letter-exchange", "direct", {
      //   durable: true,
      // });

      // // Create dead letter queue
      // await this.channel.assertQueue(`${queueName}_dead_letter`, {
      //   durable: true,
      // });

      // Bind dead letter queue to exchange
      // await this.channel.bindQueue(
      //   `${queueName}_dead_letter`,
      //   "dead-letter-exchange",
      //   queueName
      // );

      await this.channel.prefetch(1);
      logger.info(`Queue ${queueName} setup complete`);
    } catch (error) {
      logger.error(`Queue ${queueName} creation failed`, error);
      throw error;
    }
  }

  async consume(queueName, callback) {
    try {
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            // ADDED: Content type checking
            const contentType = msg.properties.contentType;
            let content;

            // ADDED: Content handling logic based on type
            if (contentType === "application/pdf") {
              // Direct PDF handling
              content = msg.content;
            } else {
              // JSON handling
              content = JSON.parse(msg.content.toString());
            }

            // MODIFIED: Changed callback parameter to include properties
            await callback({ content, properties: msg.properties });
            this.channel.ack(msg);
          } catch (error) {
            logger.error("Error processing message:", error);
            // ADDED: Improved requeue logic
            const requeue = !(error instanceof SyntaxError);
            this.channel.nack(msg, false, requeue);
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
