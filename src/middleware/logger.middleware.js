const notificationService = require("../services/notification.service");

const loggerMiddleware = (req, res, next) => {
    notificationService.logSystemNotification(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    next();
}

module.exports = loggerMiddleware;