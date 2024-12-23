class PrintError extends Error {
    constructor(message, isRetryable = false) {
        super(message);
        this.name = 'PrintError';
        this.isRetryable = isRetryable;
    }
}

module.exports = { PrintError };