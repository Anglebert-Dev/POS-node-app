const path = require('path');
require('dotenv').config();

module.exports = {
    env: process.env.NODE_ENV || 'development',
    businessId: process.env.BUSINESS_ID,
    queuePrefix: 'print_queue_',
    port: parseInt(process.env.PORT, 10) || 3000,
    printers: require('./printers.config'),
    rabbitmq: require('./rabbitmq.config')
};