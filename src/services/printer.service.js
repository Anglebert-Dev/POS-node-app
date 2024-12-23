const net = require("net");
const config = require("../config");
const logger = require("./logger.service");
const { PrintError } = require("../utils/errors");

class PrinterServer {
  async print(printerId, pdfBuffer, metadata) {
    const printer = config.printers[printerId];
    if (!printer) {
      throw new PrintError(`Printer ${printerId} not found`);
    }

    if (printer.connection_type === "network") {
      return this.networkPrint(printer, pdfBuffer, metadata);
    }

    throw new PrintError(
      `Unsupported printer type: ${printer.connection_type}`
    );
  }

  async networkPrint(printer, pdfBuffer, metadata) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new PrintError("Print timeout"));
      }, 30000);

      client.connect(9100, printer.ip, () => {
        logger.info(`Printing ${metadata.fileName} to ${printer.name}`);
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
        reject(new PrintError(`Printing failed: ${error.message}`));
      });
    });
  }
}

module.exports = new PrinterServer();
