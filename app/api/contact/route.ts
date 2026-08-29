import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendContactMessage } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  subject: z.enum(["Listing help", "Report issue", "Claim listing", "Correction", "Complaint", "Privacy", "Partnership", "General"]),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && process.env.NODE_ENV === "production") {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host");
    if (originHost !== requestHost && originHost !== new URL(SITE_URL).host) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return NextResponse.json({ error: "Message is too large" }, { status: 413 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the form fields" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ sent: true });

  const sent = await sendContactMessage(parsed.data);
  if (!sent) return NextResponse.json({ error: "Message delivery is temporarily unavailable. Please use email or WhatsApp." }, { status: 503 });
  return NextResponse.json({ sent: true }, { status: 201 });
}
