/**
 * Admin email notifications via Resend.
 *
 * Requires RESEND_API_KEY env var (free tier: 100 emails/day).
 * Sends to ADMIN_EMAIL (defaults to thabisocontractorservices@gmail.com).
 *
 * Fails silently — notification failures must never break the main flow.
 */

const RESEND_API = "https://api.resend.com/emails";
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@kznplumbers.co.za";
const FROM_EMAIL =
  process.env.FROM_EMAIL || "KZN Plumbers <admin@kznplumbers.co.za>";

type NotifyPayload = {
  subject: string;
  html: string;
};

async function send({ subject, html }: NotifyPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping notification");
    return;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error:", res.status, body);
    }
  } catch (err) {
    console.error("[email] Failed to send notification:", err);
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

export function notifyNewRegistration({
  tradingName,
  area,
  email,
  phone,
  specialties,
}: {
  tradingName: string;
  area: string;
  email: string;
  phone: string;
  specialties: string[];
}) {
  return send({
    subject: `🆕 New plumber registered: ${tradingName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #1A5FBE; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">New Plumber Registration</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Business</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${tradingName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Area</td>
              <td style="padding: 8px 0; font-size: 14px;">${area}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; font-size: 14px;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Phone</td>
              <td style="padding: 8px 0; font-size: 14px;">${phone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Specialties</td>
              <td style="padding: 8px 0; font-size: 14px;">${specialties.join(", ")}</td>
            </tr>
          </table>
          <div style="margin-top: 20px;">
            <a href="https://www.kznplumbers.co.za/admin" style="display: inline-block; background: #1A5FBE; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
              Review in Admin →
            </a>
          </div>
        </div>
      </div>
    `,
  });
}

export function notifyNewClaim({
  tradingName,
  claimantEmail,
  phoneEntered,
  phoneMatch,
  status,
}: {
  tradingName: string;
  claimantEmail: string;
  phoneEntered: string;
  phoneMatch: boolean;
  status: "auto_approved" | "pending";
}) {
  const statusBadge = phoneMatch
    ? '<span style="background: #D1FAE5; color: #065F46; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">Auto-approved ✓</span>'
    : '<span style="background: #FEF3C7; color: #92400E; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">Pending review ⏳</span>';

  return send({
    subject: `📋 Business claim: ${tradingName} (${status})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: ${phoneMatch ? "#059669" : "#D97706"}; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">Business Claim ${phoneMatch ? "Auto-Approved" : "Needs Review"}</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="margin-bottom: 16px;">${statusBadge}</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Business</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${tradingName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Claimant</td>
              <td style="padding: 8px 0; font-size: 14px;">${claimantEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Phone entered</td>
              <td style="padding: 8px 0; font-size: 14px;">${phoneEntered}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Phone match</td>
              <td style="padding: 8px 0; font-size: 14px;">${phoneMatch ? "✅ Yes — matched listing" : "❌ No — needs manual review"}</td>
            </tr>
          </table>
          ${
            !phoneMatch
              ? `<div style="margin-top: 20px;">
              <a href="https://www.kznplumbers.co.za/admin" style="display: inline-block; background: #D97706; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Review Claim in Admin →
              </a>
            </div>`
              : ""
          }
        </div>
      </div>
    `,
  });
}
