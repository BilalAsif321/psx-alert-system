const https = require("https");
const logger = require("./logger");
const POLL_INTERVAL_MS = 30000;
class Poller {
  constructor(store, alertEngine) {
    this.store = store;
    this.alertEngine = alertEngine;
    this.running = false;
    this.cycles = 0;
    this.timer = null;
  }
  async start() {
    logger.info("Poller starting - HTML parser mode");
    this.running = true;
    await this._poll();
  }
  stop() { this.running = false; if (this.timer) clearTimeout(this.timer); }
  async _poll() {
    if (!this.running) return;
    const t0 = Date.now();
    try {
      const html = await this._fetchHtml();
      const stocks = this._parseTable(html);
      this.cycles++;
      let loaded = 0;
      const now = Date.now();
      for (const s of stocks) {
        if (s.symbol && s.price > 0) {
          this.store.addTick(s.symbol, s.price, s.value, now);
          this.alertEngine.evaluate(s.symbol, s.price, s.value, now);
          loaded++;
        }
      }
      const elapsed = Date.now() - t0;
      logger.info("Cycle " + this.cycles + " done in " + elapsed + "ms - " + loaded + "/" + stocks.length + " symbols | Store: " + this.store.getSummary().totalEntries + " entries");
    } catch (err) { logger.error("Poll failed: " + err.message); }
    if (this.running) this.timer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
  }
  _parseTable(html) {
    const stocks = [];
    const headerMatches = [...html.matchAll(/<th[^>]*data-name="([^"]+)"[^>]*>/gi)];
    if (headerMatches.length === 0) { logger.warn("No headers found"); return stocks; }
    const cols = headerMatches.map(m => m[1].toLowerCase().trim());
    if (this.cycles === 0) logger.info("Columns: " + cols.join(", "));
    const si = cols.indexOf("symbol");
    const ci = cols.indexOf("close");
    const li = cols.indexOf("ldcp");
    const vi = cols.indexOf("volume");
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) { logger.warn("No tbody found"); return stocks; }
    const rows = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g,"").replace(/&nbsp;/g,"").trim());
      if (cells.length < 3) continue;
      const sym = si >= 0 ? cells[si] : null;
      if (!sym) continue;
      const pn = (i) => { if (i<0||i>=cells.length) return 0; const v=parseFloat(cells[i].replace(/,/g,"")); return isNaN(v)?0:v; };
      const price = pn(ci) || pn(li);
      const volume = pn(vi);
      const value = price * volume;
      stocks.push({ symbol: sym, price, value });
    }
    if (stocks.length > 0 && this.cycles === 0) logger.info("Sample: " + JSON.stringify(stocks[0]));
    return stocks;
  }
  _fetchHtml() {
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname: "dps.psx.com.pk", path: "/market-watch", method: "GET", headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,*/*", "Referer": "https://dps.psx.com.pk/" }, timeout: 15000 }, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => { logger.info("HTTP " + res.statusCode + " " + body.length + " bytes"); resolve(body); });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
      req.end();
    });
  }
}
module.exports = Poller;
