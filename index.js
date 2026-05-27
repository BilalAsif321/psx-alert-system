const WebSocketClient = require('./src/websocket');
const AlertEngine = require('./src/alertEngine');
const EmailService = require('./src/emailService');
const Store = require('./src/store');
const logger = require('./src/logger');

async function main() {
  logger.info('🚀 PSX Alert System starting...');

  const store = new Store();
  const emailService = new EmailService();
  const alertEngine = new AlertEngine(store, emailService);
  const wsClient = new WebSocketClient(store, alertEngine);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    wsClient.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    wsClient.disconnect();
    process.exit(0);
  });

  await wsClient.connect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
