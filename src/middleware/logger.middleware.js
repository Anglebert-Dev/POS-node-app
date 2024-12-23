const logger = require("../services/logger.service");

const loggerMiddleware= (req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
}

module.exports = loggerMiddleware;