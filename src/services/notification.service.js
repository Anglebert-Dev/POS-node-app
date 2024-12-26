const winston = require('winston');
const path = require('path');

class NotificationService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
                    
                    if (metadata.stack) {
                        msg += `\nStack Trace:\n${metadata.stack}`;
                    }
                    
                    if (metadata.isRetryable !== undefined) {
                        msg += `\nRetryable: ${metadata.isRetryable}`;
                    }
                    
                    return msg;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/notifications.log'),
                    level: 'info'
                }),
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/critical-errors.log'),
                    level: 'error'
                })
            ]
        });
    }

    logPrintError(error, metadata = {}) {
        this.logger.error('Print Error Occurred', {
            error: error.message,
            code: error.code || 'UNKNOWN',
            printer: metadata.printerId || 'UNKNOWN',
            isRetryable: metadata.isRetryable || false,
            stack: error.stack
        });
    }

    logConnectionError(error, metadata = {}) {
        this.logger.error('Connection Error Occurred', {
            error: error.message,
            service: metadata.service || 'UNKNOWN',
            host: metadata.host || 'UNKNOWN',
            port: metadata.port || 'UNKNOWN',
            isRetryable: metadata.isRetryable || true,
            stack: error.stack
        });
    }

    logQueueError(error, metadata = {}) {
        this.logger.error('Queue Processing Error', {
            error: error.message,
            queue: metadata.queueName || 'UNKNOWN',
            messageId: metadata.messageId || 'UNKNOWN',
            isRetryable: metadata.isRetryable || false,
            stack: error.stack
        });
    }

    logSystemNotification(message, metadata = {}) {
        this.logger.info('System Notification', {
            message,
            ...metadata
        });
    }
}

module.exports = new NotificationService();