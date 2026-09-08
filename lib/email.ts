const RESEND_API = "https://api.resend.com/emails";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@kznplumbers.co.za";
const FROM_EMAIL = process.env.FROM_EMAIL || "KZN Plumbers <admin@kznplumbers.co.za>";

type NotifyPayload = { subject: string; html: string; replyTo?: string };

async function send({ subject, html, replyTo }: NotifyPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping notification");
    return false;
  }
  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!response.ok) {
      console.error("[email] Resend error:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Failed to send notification:", error);
    return false;
  }
}

export function notifyNewRegistration({ tradingName, area, email, phone, specialties }: { tradingName: string; area: string; email: string; phone: string; specialties: string[] }) {
  const business = escapeHtml(tradingName);
  return send({
    subject: `New plumber application: ${tradingName.slice(0, 80)}`,
    replyTo: email,
    html: emailShell("New plumber application", `
      <p><strong>Business:</strong> ${business}</p>
      <p><strong>Area:</strong> ${escapeHtml(area)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Listed services:</strong> ${specialties.map(escapeHtml).join(", ")}</p>
      <p><a href="https://www.kznplumbers.co.za/admin">Review in admin</a></p>
    `),
  });
}

export function notifyNewClaim({ tradingName, claimantEmail, phoneEntered, phoneMatch, status }: { tradingName: string; claimantEmail: string; phoneEntered: string; phoneMatch: boolean; status: "auto_approved" | "pending" }) {
  return send({
    subject: `Ownership review: ${tradingName.slice(0, 80)} (${status})`,
    replyTo: claimantEmail,
    html: emailShell("Ownership review required", `
      <p><strong>Business:</strong> ${escapeHtml(tradingName)}</p>
      <p><strong>Claimant:</strong> ${escapeHtml(claimantEmail)}</p>
      <p><strong>Phone entered:</strong> ${escapeHtml(phoneEntered)}</p>
      <p><strong>Public phone comparison:</strong> ${phoneMatch ? "Matched — still requires ownership review" : "Did not match — request additional evidence"}</p>
      <p><a href="https://www.kznplumbers.co.za/admin?tab=claims">Review claim in admin</a></p>
    `),
  });
}

export function sendContactMessage({ name, email, phone, subject, message }: { name: string; email: string; phone?: string; subject: string; message: string }) {
  return send({
    subject: `KZN Plumbers contact: ${subject.slice(0, 100)}`,
    replyTo: email,
    html: emailShell("Contact form message", `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0" />
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `),
  });
}

function emailShell(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
    <div style="background:#0f172a;color:#fff;padding:18px 22px"><h2 style="margin:0;font-size:19px">${escapeHtml(title)}</h2></div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;line-height:1.55">${body}</div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character] || character);
}
