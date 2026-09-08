"use client";

import { useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { DIRECTORY_SERVICES } from "@/lib/directory";
import { callLink, formatWhatsApp, isValidSAPhone, whatsAppLink } from "@/lib/utils";

export function BookingForm({ plumberId, plumberWhatsApp, plumberName }: { plumberId: string; plumberWhatsApp: string; plumberName: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string; whatsappUrl: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Retained for retries on this mounted form only. No cross-device persistence is promised.
  const requestKey = useRef<string | null>(null);
  const validCall = /^27[1-8]\d{8}$/.test(formatWhatsApp(plumberWhatsApp));
  const supportsWhatsApp = isValidSAPhone(plumberWhatsApp);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const preferred = new Date(String(form.get("datetime") || ""));
      if (!Number.isFinite(preferred.getTime())) throw new Error("Choose a valid preferred date and time.");
      const payload = {
        plumber_id: plumberId,
        customer_name: String(form.get("name") || "").trim(),
        customer_phone: String(form.get("phone") || "").trim(),
        customer_email: String(form.get("email") || "").trim() || undefined,
        service: String(form.get("service") || ""),
        suburb: String(form.get("suburb") || "").trim(),
        urgency: String(form.get("urgency") || "planned"),
        job_description: String(form.get("description") || "").trim(),
        preferred_datetime: preferred.toISOString(),
        website: String(form.get("website") || ""),
      };
      if (!isValidSAPhone(payload.customer_phone) || !/^[+\d\s()-]+$/.test(payload.customer_phone)) throw new Error("Enter a valid South African cellphone number.");
      trackEvent("booking_submit", { plumber_id: plumberId, service: payload.service, urgency: payload.urgency });
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.booking?.id !== "string") throw new Error(result.error || "Booking request could not be confirmed as saved.");
      trackEvent("booking_complete", { plumber_id: plumberId, service: payload.service, urgency: payload.urgency });
      // Keep the booking follow-up template. The primary profile WhatsApp template is unchanged.
      const message = [
        `Hi, I found ${plumberName} on kznplumbers.co.za and submitted a booking request.`,
        `Name: ${payload.customer_name}`,
        `Phone: ${payload.customer_phone}`,
        `Area: ${payload.suburb}`,
        `Job: ${payload.service || payload.job_description}`,
        `Urgency: ${payload.urgency}`,
        `Preferred time: ${preferred.toLocaleString("en-ZA")}`,
      ].join("\n");
      setSuccess({ id: result.booking.id, whatsappUrl: supportsWhatsApp ? whatsAppLink(plumberWhatsApp, message) : null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking request could not be confirmed. Retry or use direct contact.");
    } finally { inFlight.current = false; setSubmitting(false); }
  }

  if (success) {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="font-display text-lg font-bold text-emerald-900">Request recorded</div>
        <p className="mt-2 text-xs leading-relaxed text-emerald-800">This is a request, not a confirmed appointment. Contact the business to agree the scope and arrival time.</p>
        <p className="mt-2 break-all text-[11px] text-emerald-800">Reference: {success.id}</p>
        {success.whatsappUrl ? (
          <a href={success.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4"
            onClick={() => trackEvent("whatsapp_click", { plumber_id: plumberId, source_page: "booking_success" })}>Continue on WhatsApp</a>
        ) : validCall ? (
          <a href={callLink(plumberWhatsApp)} className="btn-primary mt-4"
            onClick={() => trackEvent("call_click", { plumber_id: plumberId, source_page: "booking_success" })}>Call the business</a>
        ) : <p className="mt-3 text-xs">Use the business contact details on this profile; a valid WhatsApp number is not available.</p>}
        <p className="mt-3 text-[11px] text-emerald-800">No chat is opened automatically. Your details are included in the message only if you choose WhatsApp.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Your name"><input name="name" autoComplete="name" required minLength={2} className="input" /></Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Cellphone"><input name="phone" type="tel" autoComplete="tel" required minLength={7} placeholder="082 123 4567" className="input" /></Field>
        <Field label="Email" optional><input name="email" type="email" autoComplete="email" className="input" /></Field>
      </div>
      <Field label="Suburb or town"><input name="suburb" required minLength={2} placeholder="e.g. Glenwood" className="input" /></Field>
      <Field label="Job type">
        <select name="service" className="input" defaultValue="">
          <option value="">Choose a service</option>
          {DIRECTORY_SERVICES.map((service) => <option key={service.key} value={service.label}>{service.label}</option>)}
          <option value="Other plumbing work">Other plumbing work</option>
        </select>
      </Field>
      <Field label="Urgency">
        <select name="urgency" className="input" defaultValue="planned">
          <option value="planned">Planned or flexible</option>
          <option value="today">Needs attention today</option>
          <option value="emergency">Active emergency</option>
        </select>
      </Field>
      <Field label="Describe the problem"><textarea name="description" required minLength={5} maxLength={1500} rows={3} placeholder="What is happening, and where?" className="input resize-none" /></Field>
      <Field label="Preferred date and time"><input name="datetime" type="datetime-local" required className="input" /></Field>
      <label className="sr-only" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800"><p>{error}</p>{validCall && <a href={callLink(plumberWhatsApp)} className="mt-2 inline-block font-bold underline">Call the business instead</a>}</div>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? "Sending request…" : "Send booking request"}</button>
      <p className="text-[11px] leading-relaxed text-slate-500">Your contact details are shared with this business for this request. Do not include passwords or banking information.</p>
    </form>
  );
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-700">{label}{optional && <span className="font-normal text-slate-400"> · optional</span>}<span className="mt-1 block">{children}</span></label>;
}
