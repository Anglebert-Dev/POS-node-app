const PrintApp = require("./app");

const app = new PrintApp();

process.on("SIGTERM", async () => {
  await app.stop();
  process.exit();
});

process.on("SIGINT", async () => {
  await app.stop();
  process.exit();
});

app.start();