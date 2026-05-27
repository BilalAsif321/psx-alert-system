/**
 * EmailService
 * Sends alert emails via Resend API.
 */

const { Resend } = require('resend');
const logger = require('./logger');

const RECIPIENT = process.env.ALERT_EMAIL || 'bilalasif3458@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'PSX Alerts <onboarding@resend.dev>';

class EmailService {
  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set!');
    }
    this.resend = new Resend(apiKey);
    logger.info(`EmailService ready → alerts will go to ${RECIPIENT}`);
  }

  /**
   * Send an alert email.
   * @param {Object} alert
   */
  async sendAlert(alert) {
    const {
      symbol,
      direction,
      priceOld,
      priceNew,
      changePercent,
      dayValue,
      windowMinutes,
      timestamp,
    } = alert;

    const directionEmoji = direction === 'UP' ? '📈' : '📉';
    const directionColor = direction === 'UP' ? '#16a34a' : '#dc2626';
    const sign = changePercent > 0 ? '+' : '';
    const timeStr = new Date(timestamp).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const subject = `${directionEmoji} PSX Alert: ${symbol} ${sign}${changePercent.toFixed(2)}% in ${windowMinutes} min`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="background:${directionColor};padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">PSX TERMINAL ALERT</p>
                    <h1 style="margin:8px 0 0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-1px;">
                      ${directionEmoji} ${symbol}
                    </h1>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:28px;font-weight:900;padding:8px 16px;border-radius:8px;">
                      ${sign}${changePercent.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Price move -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td align="center" style="padding:8px 16px;border-right:1px solid #334155;">
                    <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">30-Min Ago</p>
                    <p style="margin:8px 0 0;color:#e2e8f0;font-size:26px;font-weight:700;">₨ ${priceOld.toFixed(2)}</p>
                  </td>
                  <td align="center" style="padding:8px 16px;border-right:1px solid #334155;">
                    <p style="margin:0;color:#94a3b8;font-size:20px;">→</p>
                  </td>
                  <td align="center" style="padding:8px 16px;">
                    <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Current Price</p>
                    <p style="margin:8px 0 0;color:${directionColor};font-size:26px;font-weight:700;">₨ ${priceNew.toFixed(2)}</p>
                  </td>
                </tr>
              </table>

              <!-- Stats row -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;padding:16px;">
                      <tr>
                        <td>
                          <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Day Traded Value</p>
                          <p style="margin:6px 0 0;color:#e2e8f0;font-size:18px;font-weight:700;">₨ ${(dayValue / 1e6).toFixed(1)}M</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;padding:16px;">
                      <tr>
                        <td>
                          <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Window</p>
                          <p style="margin:6px 0 0;color:#e2e8f0;font-size:18px;font-weight:700;">${windowMinutes} minutes</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Timestamp -->
              <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                Alert triggered at ${timeStr} (PKT)
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#0f172a;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#334155;font-size:11px;text-align:center;">
                PSX Terminal Alert System &bull; This is an automated alert. Not financial advice.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      const result = await this.resend.emails.send({
        from: FROM_EMAIL,
        to: RECIPIENT,
        subject,
        html,
      });
      logger.info(`✉️  Email sent for ${symbol} | ID: ${result.data?.id || 'unknown'}`);
    } catch (err) {
      logger.error(`Resend error for ${symbol}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = EmailService;
