const WebSocket = require("ws");
const logger = require("./logger");

const PSX_WS_URL = "wss://psxterminal.com/";
const RECONNECT_BASE_DELAY = 3000;
const RECONNECT_MAX_DELAY = 60000;
const STATUS_LOG_INTERVAL = 5 * 60 * 1000;

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
      logger.info("Connecting to " + PSX_WS_URL + "...");
      this.ws = new WebSocket(PSX_WS_URL, {
        headers: {
          "Host": "psxterminal.com",
          "Origin": "https://psxterminal.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      this.ws.on("open", () => {
        logger.info("WebSocket connected to PSX Terminal");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._subscribeAll();
        this._startStatusLogger();
        resolve();
      });
      this.ws.on("message", (data) => {
        try { this._handleMessage(JSON.parse(data.toString())); } catch (err) {}
      });
      this.ws.on("ping", () => { this.ws.pong(); });
      this.ws.on("close", (code, reason) => {
        logger.warn("WebSocket closed: " + code + " " + reason);
        this.isConnected = false;
        this._stopStatusLogger();
        this._scheduleReconnect();
      });
      this.ws.on("error", (err) => { logger.error("WebSocket error: " + err.message); });
    });
  }

  disconnect() {
    this._stopStatusLogger();
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); }
  }

  _subscribeAll() {
    this.ws.send(JSON.stringify({ type: "subscribe", subscriptionType: "marketData", params: { marketType: "REG" }, requestId: "req-reg-all" }));
    logger.info("Subscribed to REG market data (all symbols)");
  }

  _handleMessage(msg) {
    if (msg.type === "welcome") { logger.info("Server welcome: clientId=" + msg.clientId); }
    else if (msg.type === "subscribeResponse") {
      if (msg.status === "success") { logger.info("Subscription confirmed: " + msg.subscriptionKey); }
      else { logger.warn("Subscription failed: " + JSON.stringify(msg)); }
    }
    else if (msg.type === "tickUpdate") { this._handleTick(msg); }
    else if (msg.type === "ping") { this.ws.send(JSON.stringify({ type: "pong", timestamp: msg.timestamp })); }
    else if (msg.type === "error") { logger.warn("Server error: " + msg.message); }
  }

  _handleTick(msg) {
    const { symbol, tick } = msg;
    if (!symbol || !tick) return;
    const price = tick.c;
    const dayValue = tick.val;
    const timestamp = tick.t || Date.now();
    if (!price || price === 0) return;
    this.store.addTick(symbol, price, dayValue, timestamp);
    this.alertEngine.evaluate(symbol, price, dayValue, timestamp);
    this.tickCount++;
  }

  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1), RECONNECT_MAX_DELAY);
    logger.info("Reconnecting in " + (delay/1000) + "s (attempt " + this.reconnectAttempts + ")...");
    setTimeout(() => this.connect(), delay);
  }

  _startStatusLogger() {
    this.statusTimer = setInterval(() => {
      const { symbols, totalEntries } = this.store.getSummary();
      const recentAlerts = this.alertEngine.getRecentAlerts(5);
      logger.info("Status | Symbols: " + symbols + " | Entries: " + totalEntries + " | Ticks: " + this.tickCount + " | Alerts: " + (recentAlerts.length > 0 ? recentAlerts.map(a => a.symbol).join(", ") : "none"));
    }, STATUS_LOG_INTERVAL);
  }

  _stopStatusLogger() {
    if (this.statusTimer) { clearInterval(this.statusTimer); this.statusTimer = null; }
  }
}

module.exports = WebSocketClient;
