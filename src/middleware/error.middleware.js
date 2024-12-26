// src/middleware/error.middleware.js
const notificationService = require("../services/notification.service");

const errorMiddleware = (err, req, res, next) => {
  // Log detailed error information using our notification service
  notificationService.logSystemNotification("API Request Error", {
    message: err.message,
    path: req.path,
    method: req.method,
    code: err.statusCode || 500,
  });

  // Send appropriate response to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: statusCode === 500 ? "Internal Server Error" : err.message,
  });
};

module.exports = errorMiddleware;
