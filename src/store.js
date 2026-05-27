/**
 * Store — In-memory rolling price window
 *
 * Keeps up to MAX_ENTRIES (360) price snapshots per symbol.
 * Each snapshot: { price, value, timestamp }
 * When 361st entry arrives, the oldest is dropped automatically.
 *
 * Also tracks per-symbol day stats (volume value) from tick data.
 */

const MAX_ENTRIES = 360; // 30 min @ ~1 tick per 5 seconds

class Store {
  constructor() {
    // Map<symbol, Array<{ price, dayValue, timestamp }>>
    this.prices = new Map();

    // Map<symbol, { dayValue, lastPrice, lastSeen }>
    this.symbolStats = new Map();
  }

  /**
   * Add a new price tick for a symbol.
   * @param {string} symbol
   * @param {number} price   - current traded price
   * @param {number} dayValue - total traded value for the day (volume * avg price)
   * @param {number} timestamp - unix ms
   */
  addTick(symbol, price, dayValue, timestamp) {
    if (!this.prices.has(symbol)) {
      this.prices.set(symbol, []);
    }

    const window = this.prices.get(symbol);

    // Push new entry
    window.push({ price, dayValue, timestamp });

    // Drop oldest if over limit
    if (window.length > MAX_ENTRIES) {
      window.shift();
    }

    // Update symbol stats
    this.symbolStats.set(symbol, { dayValue, lastPrice: price, lastSeen: timestamp });
  }

  /**
   * Get the oldest price in the rolling window (30 min ago).
   * Returns null if not enough data yet.
   */
  getOldestEntry(symbol) {
    const window = this.prices.get(symbol);
    if (!window || window.length < 2) return null;
    return window[0];
  }

  /**
   * Get the latest price entry for a symbol.
   */
  getLatestEntry(symbol) {
    const window = this.prices.get(symbol);
    if (!window || window.length === 0) return null;
    return window[window.length - 1];
  }

  /**
   * Get current window size for a symbol.
   */
  getWindowSize(symbol) {
    const window = this.prices.get(symbol);
    return window ? window.length : 0;
  }

  /**
   * Get all tracked symbols.
   */
  getAllSymbols() {
    return Array.from(this.prices.keys());
  }

  /**
   * Get summary stats for logging.
   */
  getSummary() {
    const symbols = this.prices.size;
    let totalEntries = 0;
    for (const window of this.prices.values()) {
      totalEntries += window.length;
    }
    return { symbols, totalEntries };
  }
}

module.exports = Store;
