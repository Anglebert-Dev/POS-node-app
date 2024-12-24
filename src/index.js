const PrintApp = require('./app');

const app = new PrintApp();

process.on('SIGTERM', async () => {
    await app.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await app.stop();
    process.exit(0);
});

app.start();