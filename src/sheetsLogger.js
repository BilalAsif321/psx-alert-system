const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw0iCgEDShV76y9drjMyZU9BPZKKjXBclbICmv5VCJOfqqsoBrmQ2BD6lnHMgwg040V/exec";

async function logAlertToSheets(alertData) {
  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertData),
      redirect: "follow"  // Apps Script webhooks redirect, this handles it
    });

    const text = await response.text();
    console.log(`[Sheets] Log response: ${text}`);
  } catch (err) {
    console.error(`[Sheets] Failed to log alert: ${err.message}`);
    // Non-fatal — don't crash the alert system if sheets fails
  }
}

module.exports = { logAlertToSheets };