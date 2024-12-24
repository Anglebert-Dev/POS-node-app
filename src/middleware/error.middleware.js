const logger = require("../services/logger.service");

// Error-handling middleware must include the `err` parameter
const errorMiddleware = (err, req, res, next) => {
  logger.error('Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
};

module.exports = errorMiddleware;
