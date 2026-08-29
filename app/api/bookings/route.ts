import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { SITE_URL } from "@/lib/site";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().min(7).max(30),
  customer_email: z.string().trim().email().max(200).optional(),
  service: z.string().trim().max(120).optional().default(""),
  suburb: z.string().trim().min(2).max(120),
  urgency: z.enum(["planned", "today", "emergency"]).default("planned"),
  job_description: z.string().trim().min(5).max(1500),
  preferred_datetime: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date and time"),
  source_path: z.string().trim().max(300).optional().default(""),
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
    return NextResponse.json({ error: "Booking request is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the booking details and try again", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const preferred = new Date(parsed.data.preferred_datetime);
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() + 1);
  if (preferred > latest) {
    return NextResponse.json({ error: "Preferred date must be within the next year" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const base = {
    plumber_id: parsed.data.plumber_id,
    customer_id: user?.id ?? null,
    customer_name: parsed.data.customer_name,
    customer_phone: parsed.data.customer_phone,
    customer_email: parsed.data.customer_email || null,
    job_description: parsed.data.job_description,
    preferred_datetime: preferred.toISOString(),
  };

  const enriched = {
    ...base,
    service_requested: parsed.data.service || null,
    suburb: parsed.data.suburb,
    urgency: parsed.data.urgency,
    source_path: parsed.data.source_path || null,
  };

  let result = await supabase.from("bookings").insert(enriched).select("id, status").single();
  if (result.error && /column|schema cache/i.test(result.error.message)) {
    result = await supabase.from("bookings").insert(base).select("id, status").single();
  }

  if (result.error) {
    console.error("[bookings] Insert failed:", result.error.message);
    return NextResponse.json({ error: "The booking could not be saved. Please use direct contact." }, { status: 503 });
  }

  return NextResponse.json({ booking: result.data }, { status: 201 });
}
