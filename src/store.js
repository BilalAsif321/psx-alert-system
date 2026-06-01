const MAX_ENTRIES = 60;
class Store {
  constructor() {
    this.prices = new Map();
    this.symbolStats = new Map();
  }
  addTick(symbol, price, dayValue, timestamp) {
    if (!this.prices.has(symbol)) this.prices.set(symbol, []);
    const window = this.prices.get(symbol);
    window.push({ price, dayValue, timestamp });
    if (window.length > MAX_ENTRIES) window.shift();
    this.symbolStats.set(symbol, { dayValue, lastPrice: price, lastSeen: timestamp });
  }
  getOldestEntry(symbol) {
    const window = this.prices.get(symbol);
    if (!window || window.length < MAX_ENTRIES) return null;
    return window[0];
  }
  getLatestEntry(symbol) {
    const window = this.prices.get(symbol);
    if (!window || window.length === 0) return null;
    return window[window.length - 1];
  }
  getWindowSize(symbol) { const w = this.prices.get(symbol); return w ? w.length : 0; }
  getAllSymbols() { return Array.from(this.prices.keys()); }
  getSummary() {
    let totalEntries = 0;
    for (const w of this.prices.values()) totalEntries += w.length;
    return { symbols: this.prices.size, totalEntries };
  }
}
module.exports = Store;
