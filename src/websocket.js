/**
 * WebSocketClient
 *
 * Connects to wss://psxterminal.com/
 * Subscribes to marketData:all for live tick updates on all symbols.
 * Feeds ticks into Store and AlertEngine.
 *
 * Auto-reconnects on disconnect with exponential backoff.
 */

const WebSocket = require('ws');
const logger = require('./logger');

const PSX_WS_URL = 'wss://psxterminal.com/';
const RECONNECT_BASE_DELAY = 3000;   // 3 seconds
const RECONNECT_MAX_DELAY = 60000;   // 60 seconds
const STATUS_LOG_INTERVAL = 5 * 60 * 1000; // log stats every 5 minutes

class WebSocketClient {
  constructor(store, alertEngine) {
    this.store = store;
    this.alertEngine = alertEngine;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.tickCount = 0;
    this.statusTimer = null;
  }

  connect() {
    return new Promise((resolve) => {
      logger.info(`Connecting to ${PSX_WS_URL}...`);

      this.ws = new WebSocket(PSX_WS_URL);

      this.ws.on('open', () => {
        logger.info('✅ WebSocket connected to PSX Terminal');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._subscribeAll();
        this._startStatusLogger();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          this._handleMessage(JSON.parse(data.toString()));
        } catch (err) {
          // Ignore malformed messages
        }
      });

      this.ws.on('ping', () => {
        this.ws.pong();
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this._stopStatusLogger();
        this._scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        logger.error(`WebSocket error: ${err.message}`);
        // close event will follow and trigger reconnect
      });
    });
  }

  disconnect() {
    this._stopStatusLogger();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }
  }

  _subscribeAll() {
    // Subscribe to all REG market data (all symbols)
    const subscribeMsg = {
      type: 'subscribe',
      subscriptionType: 'marketData',
      params: {
        marketType: 'REG',
      },
      requestId: 'req-reg-all',
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    logger.info('📡 Subscribed to REG market data (all symbols)');
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        logger.info(`Server welcome: clientId=${msg.clientId}`);
        break;

      case 'subscribeResponse':
        if (msg.status === 'success') {
          logger.info(`Subscription confirmed: ${msg.subscriptionKey}`);
        } else {
          logger.warn(`Subscription failed: ${JSON.stringify(msg)}`);
        }
        break;

      case 'tickUpdate':
        this._handleTick(msg);
        break;

      case 'ping':
        // Respond with pong
        this.ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
        break;

      case 'error':
        logger.warn(`Server error: ${msg.message}`);
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  _handleTick(msg) {
    const { symbol, tick } = msg;
    if (!symbol || !tick) return;

    const price = tick.c;   // current price
    const dayValue = tick.val; // total day value (volume * avg price)
    const timestamp = tick.t || Date.now();

    // Skip ticks with no price
    if (!price || price === 0) return;

    // Add to store
    this.store.addTick(symbol, price, dayValue, timestamp);

    // Run alert evaluation
    this.alertEngine.evaluate(symbol, price, dayValue, timestamp);

    this.tickCount++;
  }

  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY
    );
    logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => this.connect(), delay);
  }

  _startStatusLogger() {
    this.statusTimer = setInterval(() => {
      const { symbols, totalEntries } = this.store.getSummary();
      const recentAlerts = this.alertEngine.getRecentAlerts(5);
      logger.info(
        `📊 Status | Symbols tracked: ${symbols} | Price entries: ${totalEntries} | ` +
        `Ticks received: ${this.tickCount} | Recent alerts: ${recentAlerts.length > 0 ? recentAlerts.map(a => a.symbol).join(', ') : 'none'}`
      );
    }, STATUS_LOG_INTERVAL);
  }

  _stopStatusLogger() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }
}

module.exports = WebSocketClient;
