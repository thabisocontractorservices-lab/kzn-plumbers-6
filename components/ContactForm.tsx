"use client";

import { useState } from "react";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Message could not be sent");
      setState("sent");
      event.currentTarget.reset();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Message could not be sent");
    }
  }

  if (state === "sent") {
    return <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="font-display text-xl font-bold text-emerald-950">Message received</h2><p className="mt-2 text-sm text-emerald-900">We&apos;ll reply using the email address you supplied.</p><button type="button" onClick={() => setState("idle")} className="btn-secondary mt-4">Send another message</button></div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name"><input required name="name" autoComplete="name" minLength={2} className="input" /></Field>
        <Field label="Email"><input required name="email" type="email" autoComplete="email" className="input" /></Field>
      </div>
      <Field label="Phone" optional><input name="phone" type="tel" autoComplete="tel" className="input" /></Field>
      <Field label="Topic"><select name="subject" required defaultValue="" className="input"><option value="" disabled>Select a topic</option><option>Listing help</option><option>Report issue</option><option>Claim listing</option><option>Correction</option><option>Complaint</option><option>Privacy</option><option>Partnership</option><option>General</option></select></Field>
      <Field label="Message"><textarea name="message" required minLength={10} maxLength={4000} rows={6} className="input resize-none" /></Field>
      <label className="sr-only" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {state === "error" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="btn-primary w-full">{state === "sending" ? "Sending…" : "Send message"}</button>
      <p className="text-xs leading-relaxed text-slate-500">Do not send passwords, banking details, identity numbers or unredacted private documents.</p>
    </form>
  );
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-700">{label}{optional && <span className="font-normal text-slate-400"> · optional</span>}<span className="mt-1 block">{children}</span></label>;
}
