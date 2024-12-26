const net = require("net");
const config = require("../config");
const notificationService = require("./notification.service");
const { PrintError } = require("../utils/errors");

class PrinterServer {
  async print(printerId, pdfBuffer, metadata) {
    const printer = Object.values(config.printers).find(
      (p) => p.ip === printerId
    );

    if (!printer) {
      const error = new PrintError(`Printer with address ${printerId} not found`);
      notificationService.logPrintError(error, { printerId });
      throw error;
    }

    if (printer.connection_type === "network") {
      return this.networkPrint(printer, pdfBuffer, metadata);
    }

    const error = new PrintError(
      `Unsupported printer type: ${printer.connection_type}`
    );
    notificationService.logPrintError(error, { printerId });
    throw error;
  }

  async networkPrint(printer, pdfBuffer, metadata) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        const error = new PrintError("Print timeout");
        notificationService.logPrintError(error, {
          printerId: printer.ip,
          isRetryable: true
        });
        reject(error);
      }, 30000);

      client.connect(9100, printer.ip, () => {
        notificationService.logSystemNotification(
          `Printing ${metadata.fileName} to ${printer.name}`,
          { printer: printer.name, file: metadata.fileName }
        );
        client.write(pdfBuffer, () => {
          clearTimeout(timeout);
          client.end();
        });
      });

      client.on("close", () => {
        clearTimeout(timeout);
        resolve("Print job completed");
      });

      client.on("error", (error) => {
        clearTimeout(timeout);
        const printError = new PrintError(`Printing failed: ${error.message}`);
        notificationService.logPrintError(printError, {
          printerId: printer.ip,
          isRetryable: error.code === 'ETIMEDOUT'
        });
        reject(printError);
      });
    });
  }
}

module.exports = new PrinterServer();