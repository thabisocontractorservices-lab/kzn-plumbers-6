"use client";

import { useState } from "react";
import { whatsAppLink } from "@/lib/utils";

export function BookingForm({
  plumberId,
  plumberWhatsApp,
  plumberName,
}: {
  plumberId: string;
  plumberWhatsApp: string;
  plumberName: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      plumber_id: plumberId,
      customer_name: fd.get("name") as string,
      customer_phone: fd.get("phone") as string,
      job_description: fd.get("description") as string,
      preferred_datetime: fd.get("datetime") as string,
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess(true);

      // Pre-fill a WhatsApp message to the plumber
      const summary = `Hi ${plumberName.split(" ")[0]}, I just submitted a booking request via KZN Plumbers Directory:%0A%0A• Name: ${payload.customer_name}%0A• Phone: ${payload.customer_phone}%0A• Job: ${payload.job_description}%0A• When: ${new Date(payload.preferred_datetime).toLocaleString("en-ZA")}`;
      window.open(
        `${whatsAppLink(plumberWhatsApp)}?text=${summary}`,
        "_blank",
      );
    } catch (err) {
      console.error(err);
      alert("Booking failed. Please try WhatsApp instead.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-teal-light border border-teal/30 rounded-lg p-4 text-center">
        <div className="text-2xl mb-2">✓</div>
        <div className="font-semibold text-teal mb-1">Booking sent!</div>
        <div className="text-xs text-gray-600">
          The plumber will reply on WhatsApp. We've also opened a chat for you.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">
          Your name
        </label>
        <input
          name="name"
          required
          placeholder="e.g. Themba Khumalo"
          className="input"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">
          Phone
        </label>
        <input
          name="phone"
          required
          placeholder="+27 82 123 4567"
          className="input"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">
          Job description
        </label>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="e.g. Burst pipe in kitchen, water leaking under sink"
          className="input resize-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">
          Preferred date & time
        </label>
        <input name="datetime" type="datetime-local" required className="input" />
      </div>
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Sending..." : "Send Booking Request"}
      </button>
    </form>
  );
}
