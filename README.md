# PSX Alert System

Real-time Pakistan Stock Exchange alert system. Sends an email whenever any stock moves **±5% within a 30-minute rolling window**, provided the day's traded value exceeds **PKR 10 million**.

## How It Works

```
PSX WebSocket (wss://psxterminal.com/)
         ↓  live ticks (price, volume, value)
    WebSocketClient
         ↓
       Store  ←── rolling 360-entry window per symbol (~30 min)
         ↓
    AlertEngine  ←── checks: |change| ≥ 5% AND dayValue ≥ 10M PKR
         ↓
    EmailService  ──→ Resend API ──→ your inbox
         ↓
      alerts.db  ←── SQLite log of all fired alerts
```

## Project Structure

```
psx-alert-system/
├── index.js              # Entry point
├── package.json
├── railway.toml          # Railway deployment config
├── .env.example          # Environment variable template
└── src/
    ├── websocket.js      # PSX WebSocket client + auto-reconnect
    ├── store.js          # In-memory rolling price window
    ├── alertEngine.js    # Alert logic + SQLite logging
    ├── emailService.js   # Resend email sender
    └── logger.js         # Timestamped logger (PKT timezone)
```

## Alert Conditions

| Condition | Value |
|-----------|-------|
| Price move threshold | ±5% |
| Measurement window | Rolling 30 minutes |
| Minimum day traded value | PKR 10,000,000 |
| Alert cooldown per symbol | 30 minutes |

---

## Deployment on Railway

### Step 1 — Push to GitHub

```bash
# In your terminal
cd psx-alert-system
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/psx-alert-system.git
git push -u origin main
```

### Step 2 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Select your `psx-alert-system` repository
4. Railway will detect Node.js automatically

### Step 3 — Add Environment Variables

In Railway dashboard → your service → **Variables** tab:

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Your Resend API key |
| `ALERT_EMAIL` | bilalasif3458@gmail.com |

**Never put your API key in code or GitHub.**

### Step 4 — Deploy

Railway will auto-deploy when you push to GitHub. Watch logs in the **Deployments** tab.

You should see:
```
INFO  PSX Alert System starting...
INFO  Alert database ready (alerts.db)
INFO  EmailService ready → alerts will go to bilalasif3458@gmail.com
INFO  Connecting to wss://psxterminal.com/...
INFO  ✅ WebSocket connected to PSX Terminal
INFO  📡 Subscribed to REG market data (all symbols)
```

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your RESEND_API_KEY

# Run
npm start
```

---

## Alert Email Format

Each alert email includes:
- Symbol name and direction (📈 UP / 📉 DOWN)
- % change prominently displayed
- Price 30 minutes ago → current price
- Day's total traded value
- Exact time window (in minutes)
- Timestamp in Pakistan time (PKT)

---

## Notes

- The rolling window fills up within the first 30 minutes of startup — no alerts fire until then
- If the WebSocket disconnects, it auto-reconnects with exponential backoff (max 60s delay)
- All fired alerts are saved to `alerts.db` (SQLite) on the Railway volume
- Status is logged every 5 minutes showing symbols tracked, tick count, and recent alerts
- PSX market hours are approximately 09:30–15:30 PKT Monday–Friday; ticks will be sparse outside those hours
