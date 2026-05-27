const logger = require(`./logger`);

const PRICE_CHANGE_THRESHOLD = 5.0;
const MIN_DAY_VALUE = 10_000_000;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_LOG_SIZE = 500;

class AlertEngine {
  constructor(store, emailService) {
    this.store = store;
    this.emailService = emailService;
    this.lastAlerted = new Map();
    this.alertLog = [];
    logger.info("AlertEngine initialized");
  }

  evaluate(symbol, currentPrice, dayValue, timestamp) {
    const oldest = this.store.getOldestEntry(symbol);
    if (!oldest) return;
    const priceOld = oldest.price;
    if (!priceOld || priceOld === 0) return;
    const changePercent = ((currentPrice - priceOld) / priceOld) * 100;
    if (Math.abs(changePercent) < PRICE_CHANGE_THRESHOLD) return;
    if (dayValue < MIN_DAY_VALUE) return;
    const lastAlert = this.lastAlerted.get(symbol) || 0;
    if (timestamp - lastAlert < ALERT_COOLDOWN_MS) return;
    const direction = changePercent > 0 ? "UP" : "DOWN";
    const windowMinutes = ((timestamp - oldest.timestamp) / 60000).toFixed(1);
    logger.info(`ALERT: ${symbol} ${direction} ${changePercent.toFixed(2)}% (${priceOld} to ${currentPrice}) | Value: PKR ${(dayValue / 1e6).toFixed(1)}M`);
    this.lastAlerted.set(symbol, timestamp);
    this._logAlert(symbol, direction, priceOld, currentPrice, changePercent, dayValue, windowMinutes);
    this.emailService.sendAlert({ symbol, direction, priceOld, priceNew: currentPrice, changePercent, dayValue, windowMinutes, timestamp })
      .catch((err) => logger.error(`Email send failed for ${symbol}: ${err.message}`));
  }

  _logAlert(symbol, direction, priceOld, priceNew, changePercent, dayValue, windowMinutes) {
    this.alertLog.push({ symbol, direction, priceOld, priceNew, changePercent: parseFloat(changePercent.toFixed(2)), dayValue, windowMinutes, firedAt: new Date().toISOString() });
    if (this.alertLog.length > MAX_LOG_SIZE) this.alertLog.shift();
  }

  getRecentAlerts(limit = 10) {
    return this.alertLog.slice(-limit).reverse();
  }
}

module.exports = AlertEngine;
