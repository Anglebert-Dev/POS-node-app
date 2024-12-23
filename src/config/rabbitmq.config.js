module.exports = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    options: {
        heartbeat: 60,
        connection_timeout: 10000
    }
};




