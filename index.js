require("dotenv").config();
const Poller = require("./src/poller");
const AlertEngine = require("./src/alertEngine");
const EmailService = require("./src/emailService");
const Store = require("./src/store");
const logger = require("./src/logger");

async function main() {
  logger.info("PSX Alert System starting - REST polling mode");
  const store = new Store();
  const emailService = new EmailService();
  const alertEngine = new AlertEngine(store, emailService);
  const poller = new Poller(store, alertEngine);
  process.on("SIGINT", () => { poller.stop(); process.exit(0); });
  process.on("SIGTERM", () => { poller.stop(); process.exit(0); });
  await poller.start();
}

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
