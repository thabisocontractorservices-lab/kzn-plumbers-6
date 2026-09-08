import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, privateJson, requireSameOrigin, requireUser } from "@/lib/server-access";
import { authFlowPublishedBusiness } from "@/lib/auth-flow-records";
import { authFlowFailure as accessFailure, missingAuthFlowColumn, readAuthFlowJson } from "@/lib/auth-flow-input";
import { isValidSAPhone, formatWhatsApp } from "@/lib/utils";
import { DIRECTORY_SERVICES } from "@/lib/directory";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().max(30).regex(/^[+\d\s()-]+$/).refine(isValidSAPhone),
  customer_email: z.string().trim().email().max(200).optional(),
  service: z.string().trim().max(120).default("").refine((value) => !value || value === "Other plumbing work" || DIRECTORY_SERVICES.some((service) => service.label === value)),
  suburb: z.string().trim().min(2).max(120),
  urgency: z.enum(["planned", "today", "emergency"]).default("planned"),
  job_description: z.string().trim().min(5).max(1500),
  // Clients send an explicit offset; a datetime-local string is otherwise server-timezone dependent.
  preferred_datetime: z.string().datetime({ offset: true }),
  source_path: z.string().max(300).optional(),
  website: z.string().max(0).default(""),
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 8192));
    if (!parsed.success) return privateJson({ error: "Check the booking details and try again.", issues: parsed.error.flatten().fieldErrors }, 400);
    const input = parsed.data;
    const preferred = new Date(input.preferred_datetime);
    if (preferred.getTime() < Date.now() - 5 * 60 * 1000 || preferred.getTime() > Date.now() + 366 * 86400000) {
      return privateJson({ error: "Choose a preferred date from now through the next year." }, 400);
    }

    // Anonymous INSERT ... RETURNING cannot read through booking RLS. This server-only
    // service-role write is permitted only after an explicit published-business lookup.
    const business = await authFlowPublishedBusiness(input.plumber_id);
    const admin = getSupabaseAdmin();
    let customerId: string | null = null;
    try {
      const user = await requireUser(request);
      const profile = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (profile.error) throw new AccessError("Cannot check your booking account right now. Retry or use direct contact.", 503);
      customerId = profile.data?.id ?? null;
    } catch (error) {
      // Booking is also available to guests. Do not accept a client-supplied customer
      // id or attach an unconfirmed account; only genuine auth absence can downgrade.
      if (!(error instanceof AccessError) || ![401, 403].includes(error.status)) throw error;
    }
    const suppliedKey = request.headers.get("idempotency-key");
    if (suppliedKey && !z.string().uuid().safeParse(suppliedKey).success) return privateJson({ error: "Invalid request key." }, 400);
    const requestKey = suppliedKey || randomUUID();
    // Existing bookings.id is already a primary key. Scope a retry id to both the opaque
    // client key and its payload: knowledge of another booking id cannot reveal its data.
    const digest = createHash("sha256").update(JSON.stringify([
      "booking-request-v1", requestKey, business.id, input.customer_name,
      formatWhatsApp(input.customer_phone), input.customer_email?.toLowerCase() || null,
      input.service, input.suburb, input.urgency, input.job_description, preferred.toISOString(),
    ])).digest("hex");
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    // Keep the context in the legacy notes column even when optional columns do not exist.
    // No accepted/completed/outcome values are inferred from a submitted request.
    const notes = `[booking_context_v1]\n${JSON.stringify({ service_requested: input.service || null, suburb: input.suburb, urgency: input.urgency, source_path: "/plumber/[profile]" })}`;
    const payload: Record<string, unknown> = {
      id, plumber_id: business.id, customer_id: customerId,
      customer_name: input.customer_name, customer_phone: formatWhatsApp(input.customer_phone),
      customer_email: input.customer_email?.toLowerCase() || null,
      job_description: input.job_description, preferred_datetime: preferred.toISOString(),
      status: "pending", notes,
      service_requested: input.service || null, suburb: input.suburb, urgency: input.urgency,
      source_path: "/plumber/[profile]",
    };
    const optionalColumns = ["service_requested", "suburb", "urgency", "source_path"];
    let result = await admin.from("bookings").insert(payload).select("id, status").single();
    for (let attempt = 0; result.error && attempt < optionalColumns.length; attempt++) {
      const missing = missingAuthFlowColumn(result.error, "bookings", optionalColumns);
      if (!missing || !(missing in payload)) break;
      delete payload[missing];
      result = await admin.from("bookings").insert(payload).select("id, status").single();
    }
    if (result.error?.code === "23505" && suppliedKey) {
      const existing = await admin.from("bookings").select("id, status").eq("id", id).eq("plumber_id", business.id).maybeSingle();
      if (!existing.error && existing.data) return privateJson({ booking: existing.data }, 200);
    }
    if (result.error || !result.data) throw new AccessError("The booking could not be confirmed as saved. Retry with the same details or use direct contact.", 503);
    // Never return contact details or the rest of the service-role row.
    return privateJson({ booking: { id: result.data.id, status: result.data.status } }, 201);
  } catch (error) { return accessFailure(error); }
}
