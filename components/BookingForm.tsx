"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { DIRECTORY_SERVICES } from "@/lib/directory";
import { whatsAppLink } from "@/lib/utils";

export function BookingForm({ plumberId, plumberWhatsApp, plumberName }: { plumberId: string; plumberWhatsApp: string; plumberName: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      plumber_id: plumberId,
      customer_name: String(form.get("name") || ""),
      customer_phone: String(form.get("phone") || ""),
      customer_email: String(form.get("email") || "") || undefined,
      service: String(form.get("service") || ""),
      suburb: String(form.get("suburb") || ""),
      urgency: String(form.get("urgency") || "planned"),
      job_description: String(form.get("description") || ""),
      preferred_datetime: String(form.get("datetime") || ""),
      source_path: window.location.pathname,
    };

    trackEvent("booking_submit", {
      plumber_id: plumberId,
      service: payload.service,
      area: payload.suburb,
      urgency: payload.urgency,
    });

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Booking request failed");

      setSuccess(true);
      trackEvent("booking_complete", {
        plumber_id: plumberId,
        service: payload.service,
        area: payload.suburb,
        urgency: payload.urgency,
      });

      const message = [
        `Hi, I found ${plumberName} on kznplumbers.co.za and submitted a booking request.`,
        `Name: ${payload.customer_name}`,
        `Phone: ${payload.customer_phone}`,
        `Area: ${payload.suburb}`,
        `Job: ${payload.service || payload.job_description}`,
        `Urgency: ${payload.urgency}`,
        `Preferred time: ${new Date(payload.preferred_datetime).toLocaleString("en-ZA")}`,
      ].join("\n");
      window.open(whatsAppLink(plumberWhatsApp, message), "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking request failed. Try direct contact instead.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="font-display text-lg font-bold text-emerald-900">Request sent</div>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">A WhatsApp chat was opened so you can confirm the scope and arrival time directly.</p>
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
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? "Sending request…" : "Send booking request"}</button>
      <p className="text-[11px] leading-relaxed text-slate-500">Your contact details are shared with this business for this request. Do not include passwords or banking information.</p>
    </form>
  );
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-700">{label}{optional && <span className="font-normal text-slate-400"> · optional</span>}<span className="mt-1 block">{children}</span></label>;
}
