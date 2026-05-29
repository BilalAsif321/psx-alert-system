/**
 * Poller — fetches ALL stocks in one request every 30 seconds
 * Source: https://dps.psx.com.pk/market-watch
 * Fallback: https://psxterminal.com/api/ticks/REG/{symbol} individually
 */

const https = require('https');
const logger = require('./logger');

const POLL_INTERVAL_MS = 30000; // 30 seconds

class Poller {
  constructor(store, alertEngine) {
    this.store = store;
    this.alertEngine = alertEngine;
    this.running = false;
    this.cycles = 0;
    this.timer = null;
  }

  async start() {
    logger.info('Poller starting — using dps.psx.com.pk/market-watch (bulk endpoint)');
    this.running = true;
    await this._poll();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  async _poll() {
    if (!this.running) return;

    const t0 = Date.now();
    try {
      const stocks = await this._fetchMarketWatch();
      const elapsed = Date.now() - t0;
      this.cycles++;

      let loaded = 0;
      const now = Date.now();

      for (const s of stocks) {
        const symbol = s.symbol || s.SYMBOL || s.code || s.s;
        const price = s.current || s.ldcp || s.price || s.close || s.c || s.last;
        const value = s.volume_value || s.value || s.val || s.turnover || 0;

        if (symbol && price && price > 0) {
          this.store.addTick(symbol, price, value, now);
          this.alertEngine.evaluate(symbol, price, value, now);
          loaded++;
        }
      }

      logger.info(
        `Cycle ${this.cycles} complete in ${elapsed}ms — ` +
        `${loaded} symbols loaded | ` +
        `Store: ${this.store.getSummary().totalEntries} entries`
      );

    } catch (err) {
      logger.error('Poll failed: ' + err.message);
      logger.info('Will retry in 30 seconds...');
    }

    // Schedule next poll
    if (this.running) {
      this.timer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
    }
  }

  _fetchMarketWatch() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'dps.psx.com.pk',
        path: '/market-watch',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://dps.psx.com.pk/',
          'Origin': 'https://dps.psx.com.pk',
        },
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          logger.info(`market-watch response: HTTP ${res.statusCode}, ${body.length} bytes`);
          try {
            const data = JSON.parse(body);
            // Handle various response shapes
            if (Array.isArray(data)) return resolve(data);
            if (data && Array.isArray(data.data)) return resolve(data.data);
            if (data && Array.isArray(data.stocks)) return resolve(data.stocks);
            if (data && Array.isArray(data.result)) return resolve(data.result);
            // Log first 300 chars to understand structure
            logger.warn('Unexpected response shape: ' + body.substring(0, 300));
            resolve([]);
          } catch (e) {
            logger.warn('Non-JSON response: ' + body.substring(0, 300));
            reject(new Error('JSON parse error: ' + e.message));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.end();
    });
  }
}

module.exports = Poller;
