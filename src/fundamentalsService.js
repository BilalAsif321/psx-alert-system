const logger = require("./logger");

async function getFundamentals(symbol) {
  try {
    const res = await fetch("https://psxterminal.com/api/fundamentals/" + symbol, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const json = await res.json();
    if (!json.success) return null;

    const f = json.data;
    return {
      peRatio: f.peRatio ?? "",
      dividendYield: f.dividendYield ?? "",
      marketCap: f.marketCap ?? "",
      sector: f.sector ?? "",
      yearChange: f.yearChange ?? "",
      listedIndices: f.listedIn ?? "",
      volume30Avg: f.volume30Avg ?? 0
    };
  } catch (err) {
    logger.error("Fundamentals fetch failed for " + symbol + ": " + err.message);
    return null;
  }
}

module.exports = { getFundamentals };