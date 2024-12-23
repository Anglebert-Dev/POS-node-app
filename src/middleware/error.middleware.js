const logger = require("../services/logger.service");

const errorMiddleware = (req, res, next) => {
    logger.error('Error: ', err);
    res.status(500).json({ message: 'Internal Server Error' });
}  

module.exports = errorMiddleware;