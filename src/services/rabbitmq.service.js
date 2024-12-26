// File: src/services/rabbitmq.service.js (UPDATED)
const amqp = require("amqplib");
const config = require("../config");
const notificationService = require("./notification.service");

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
        notificationService.logConnectionError(
          new Error("RabbitMQ connection closed"),
          {
            service: "RabbitMQ",
            isRetryable: true
          }
        );
        setTimeout(() => this.connect(), 5000);
      });

      notificationService.logSystemNotification("RabbitMQ connection established");
      return this.channel;
    } catch (error) {
      notificationService.logConnectionError(error, {
        service: "RabbitMQ",
        isRetryable: true
      });
      setTimeout(() => this.connect(), 5000);
    }
  }

  async setupQueue(queueName) {
    if (!this.channel) {
      throw new Error("No RabbitMQ channel available");
    }

    try {
      await this.channel.assertQueue(queueName, {
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "dead-letter-exchange",
          "x-message-ttl": 24 * 60 * 60 * 1000,
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
      notificationService.logSystemNotification(`Queue ${queueName} setup complete`);
    } catch (error) {
      notificationService.logQueueError(error, { queueName });
      throw error;
    }
  }

  async consume(queueName, callback) {
    try {
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const contentType = msg.properties.contentType;
            let content;

            if (contentType === "application/pdf") {
              content = msg.content;
            } else {
              content = JSON.parse(msg.content.toString());
            }

            await callback({ content, properties: msg.properties });
            this.channel.ack(msg);
          } catch (error) {
            notificationService.logQueueError(error, {
              queueName,
              messageId: msg.properties.messageId,
              isRetryable: !(error instanceof SyntaxError)
            });
            const requeue = !(error instanceof SyntaxError);
            this.channel.nack(msg, false, requeue);
          }
        }
      });
      notificationService.logSystemNotification(`Started consuming from queue: ${queueName}`);
    } catch (error) {
      notificationService.logQueueError(error, { queueName });
      throw error;
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      notificationService.logSystemNotification("RabbitMQ connection closed gracefully");
    } catch (error) {
      notificationService.logConnectionError(error, {
        service: "RabbitMQ",
        isRetryable: false
      });
      throw error;
    }
  }
}

module.exports = new RabbitMQService();