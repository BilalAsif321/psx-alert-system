/**
 * AlertEngine
 *
 * After every tick, checks if the symbol has moved ±5% compared
 * to the price from the start of the rolling 30-minute window.
 *
 * Conditions to fire alert:
 *   1. Price change >= 5% or <= -5% vs oldest entry in window
 *   2. Day's total traded value >= 10,000,000 PKR
 *   3. Cooldown: same symbol not alerted within last 30 minutes
 *
 * Fired alerts are logged to SQLite for record keeping.
 */

const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger');

const PRICE_CHANGE_THRESHOLD = 5.0;    // percent
const MIN_DAY_VALUE = 10_000_000;       // PKR 10 million
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

class AlertEngine {
  constructor(store, emailService) {
    this.store = store;
    this.emailService = emailService;

    // Cooldown tracker: Map<symbol, lastAlertTimestamp>
    this.lastAlerted = new Map();

    // Init SQLite for alert log
    this.db = new Database(path.join(process.cwd(), 'alerts.db'));
    this._initDb();

    logger.info('AlertEngine initialized');
  }

  _initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        price_old REAL NOT NULL,
        price_new REAL NOT NULL,
        change_percent REAL NOT NULL,
        day_value REAL NOT NULL,
        window_minutes REAL NOT NULL,
        fired_at TEXT NOT NULL
      )
    `);
    logger.info('Alert database ready (alerts.db)');
  }

  /**
   * Called after every tick. Evaluates alert conditions.
   * @param {string} symbol
   * @param {number} currentPrice
   * @param {number} dayValue
   * @param {number} timestamp
   */
  evaluate(symbol, currentPrice, dayValue, timestamp) {
    // Condition 1: Enough data in window?
    const oldest = this.store.getOldestEntry(symbol);
    if (!oldest) return;

    const priceOld = oldest.price;
    if (!priceOld || priceOld === 0) return;

    // Condition 2: Calculate % change
    const changePercent = ((currentPrice - priceOld) / priceOld) * 100;
    if (Math.abs(changePercent) < PRICE_CHANGE_THRESHOLD) return;

    // Condition 3: Day value filter
    if (dayValue < MIN_DAY_VALUE) return;

    // Condition 4: Cooldown check
    const lastAlert = this.lastAlerted.get(symbol) || 0;
    if (timestamp - lastAlert < ALERT_COOLDOWN_MS) return;

    // All conditions met — fire alert
    const direction = changePercent > 0 ? 'UP' : 'DOWN';
    const windowMinutes = ((timestamp - oldest.timestamp) / 60000).toFixed(1);

    logger.info(
      `🚨 ALERT: ${symbol} ${direction} ${changePercent.toFixed(2)}% ` +
      `(${priceOld} → ${currentPrice}) | Value: PKR ${(dayValue / 1e6).toFixed(1)}M`
    );

    // Update cooldown
    this.lastAlerted.set(symbol, timestamp);

    // Log to DB
    this._logAlert(symbol, direction, priceOld, currentPrice, changePercent, dayValue, windowMinutes);

    // Send email (non-blocking)
    this.emailService.sendAlert({
      symbol,
      direction,
      priceOld,
      priceNew: currentPrice,
      changePercent,
      dayValue,
      windowMinutes,
      timestamp,
    }).catch((err) => logger.error(`Email send failed for ${symbol}: ${err.message}`));
  }

  _logAlert(symbol, direction, priceOld, priceNew, changePercent, dayValue, windowMinutes) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO alerts (symbol, direction, price_old, price_new, change_percent, day_value, window_minutes, fired_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        symbol,
        direction,
        priceOld,
        priceNew,
        changePercent,
        dayValue,
        windowMinutes,
        new Date().toISOString()
      );
    } catch (err) {
      logger.error(`DB log failed: ${err.message}`);
    }
  }

  /**
   * Returns recent alerts from DB for status logging.
   */
  getRecentAlerts(limit = 10) {
    try {
      return this.db.prepare(
        'SELECT * FROM alerts ORDER BY id DESC LIMIT ?'
      ).all(limit);
    } catch {
      return [];
    }
  }
}

module.exports = AlertEngine;
