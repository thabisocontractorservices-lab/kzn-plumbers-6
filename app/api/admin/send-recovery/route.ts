import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RESEND_API = "https://api.resend.com/emails";
const FROM_EMAIL =
  process.env.FROM_EMAIL || "KZN Plumbers <admin@kznplumbers.co.za>";

/**
 * GET /api/admin/send-recovery
 *
 * One-off route to email the plumbers whose registration failed.
 * Requires admin auth (Bearer token or session cookie check).
 *
 * Delete this file after sending.
 */

const STUCK_PLUMBERS = [
  { name: "Simo", email: "simobradleykhanyile@gmail.com" },
  { name: "Stephen", email: "amanfoplumbers@gmail.com" },
  { name: "Mqapheli", email: "aneliptyltd@gmail.com" },
  { name: "Sipho", email: "admin@ayabprojects.co.za" },
  { name: "Rowen", email: "admin@25seven.co.za" },
  { name: "Sipho", email: "ayabprojects@gmail.com" },
  { name: "Mzamo", email: "mzamoh.shenge@gmail.com" },
  { name: "Yuveer", email: "plumryt@gmail.com" },
  { name: "Francis", email: "francisambuyisa077@gmail.com" },
];

function buildEmail(name: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #1A5FBE; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Complete Your KZN Plumbers Listing</h2>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #111827; margin: 0 0 16px;">Hi ${name} 👋</p>

        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
          Thank you for signing up on <strong>KZN Plumbers Directory</strong>. We had a technical issue
          that prevented your business profile from being created — we're sorry about that.
          <strong>We've fixed it now.</strong>
        </p>

        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
          To complete your free listing:
        </p>

        <div style="background: #F0F7FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
          <div style="font-size: 14px; color: #1E40AF; line-height: 1.8;">
            1. <strong>Log in</strong> at <a href="https://www.kznplumbers.co.za/login" style="color: #1A5FBE;">kznplumbers.co.za/login</a><br>
            2. Click <strong>"Set up my business"</strong><br>
            3. Fill in your business details (takes 2 minutes)
          </div>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 20px;">
          Your listing is <strong>100% free</strong> and puts you in front of homeowners across
          KwaZulu-Natal who are actively looking for plumbers.
        </p>

        <div style="text-align: center; margin: 0 0 20px;">
          <a href="https://www.kznplumbers.co.za/login"
             style="display: inline-block; background: #1A5FBE; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
            Log in & complete your profile →
          </a>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 8px;">
          If you have any trouble, just reply to this email — I'm happy to help.
        </p>

        <p style="font-size: 14px; color: #374151; margin: 0;">
          Kind regards,<br>
          <strong>Thabiso Ndlovu</strong><br>
          <span style="color: #6B7280; font-size: 13px;">KZN Plumbers Directory</span>
        </p>
      </div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  // Simple auth check — require a secret query param
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Pass ?secret=YOUR_CRON_SECRET" },
      { status: 401 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not set in env vars" },
      { status: 500 },
    );
  }

  const results: { email: string; status: string; error?: string }[] = [];

  for (const plumber of STUCK_PLUMBERS) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [plumber.email],
          reply_to: "thabisocontractorservices@gmail.com",
          subject: `${plumber.name}, complete your free KZN Plumbers listing`,
          html: buildEmail(plumber.name),
        }),
      });

      if (res.ok) {
        results.push({ email: plumber.email, status: "sent" });
      } else {
        const body = await res.text();
        results.push({ email: plumber.email, status: "failed", error: body });
      }
    } catch (err) {
      results.push({
        email: plumber.email,
        status: "error",
        error: String(err),
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status !== "sent").length;

  return NextResponse.json({
    message: `Done. ${sent} sent, ${failed} failed.`,
    results,
  });
}
