const https = require("https");
const logger = require("./logger");
const POLL_INTERVAL_MS = 30000;

class Poller {
  constructor(store, alertEngine) {
    this.store = store; this.alertEngine = alertEngine;
    this.running = false; this.cycles = 0; this.timer = null;
  }

  async start() { logger.info("Poller starting"); this.running = true; await this._poll(); }
  stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }

  async _poll() {
    if (!this.running) return;
    try {
      const html = await this._fetchHtml();
      const stocks = this._parseTable(html);
      this.cycles++;
      let loaded = 0; const now = Date.now();
      for (const s of stocks) {
        if (s.symbol && s.price > 0) {
          this.store.addTick(s.symbol, s.price, s.value, now);
          this.alertEngine.evaluate(s.symbol, s.price, s.value, now);
          loaded++;
        }
      }
      logger.info("Cycle " + this.cycles + " - " + loaded + " symbols | Store: " + this.store.getSummary().totalEntries + " entries");
      if (this.cycles === 1 && stocks.length > 0) logger.info("Sample: " + JSON.stringify(stocks[0]));
    } catch (err) { logger.error("Poll failed: " + err.message); }
    if (this.running) this.timer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
  }

  _parseTable(html) {
    const stocks = [];
    const headerMatches = [...html.matchAll(/<th[^>]*data-name="([^"]+)"[^>]*>/gi)];
    if (headerMatches.length === 0) return stocks;
    const cols = headerMatches.map(m => m[1].toLowerCase().trim());
    const si = cols.indexOf("symbol");
    const ci = cols.indexOf("close");
    const li = cols.indexOf("ldcp");
    const vi = cols.indexOf("volume");
    if (this.cycles === 0) logger.info("Col indices - symbol:" + si + " close:" + ci + " ldcp:" + li + " volume:" + vi);
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return stocks;
    const rows = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").replace(/,/g, "").trim());
      if (cells.length < 3) continue;
      const sym = si >= 0 ? cells[si] : null;
      if (!sym || sym.length < 2) continue;
      const pn = (i) => { if (i < 0 || i >= cells.length) return 0; const v = parseFloat(cells[i]); return isNaN(v) ? 0 : v; };
      const price = pn(ci) || pn(li);
      const volume = pn(vi);
      const value = price * volume;
      if (this.cycles === 0 && stocks.length === 0) logger.info("First row cells: " + JSON.stringify(cells.slice(0, 12)));
      stocks.push({ symbol: sym, price, value });
    }
    return stocks;
  }

  _fetchHtml() {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "dps.psx.com.pk",
        path: "/market-watch",
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html,*/*",
          "Referer": "https://dps.psx.com.pk/"
        },
        timeout: 15000
      }, (res) => {
        let body = "";
        const responseTimer = setTimeout(() => {
          res.destroy();
          reject(new Error("Response body timeout"));
        }, 20000);
        res.on("data", c => body += c);
        res.on("end", () => {
          clearTimeout(responseTimer);
          resolve(body);
        });
        res.on("error", (err) => {
          clearTimeout(responseTimer);
          reject(err);
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
      req.end();
    });
  }
}

module.exports = Poller;