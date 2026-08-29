"use client";

import { useState, useTransition } from "react";
import { supabase } from "@/src/supabaseClient";

const STATES = [
  { key: "available", label: "Available", dot: "bg-green-500", active: "bg-green-100 text-green-800" },
  { key: "busy", label: "Busy", dot: "bg-amber-500", active: "bg-amber-light text-amber" },
  { key: "unavailable", label: "Off", dot: "bg-red-500", active: "bg-red-100 text-red-800" },
] as const;

type Status = (typeof STATES)[number]["key"];

export function AvailabilityToggle({
  plumberId,
  initial,
  initialConfirmed = false,
}: {
  plumberId: string;
  initial: Status;
  initialConfirmed?: boolean;
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function set(s: Status) {
    const previous = status;
    const previousConfirmed = confirmed;
    setStatus(s);
    setConfirmed(s === "available");
    setError(null);
    startTransition(async () => {
      let result = await supabase
        .from("plumbers")
        .update({
          availability_status: s,
          accepts_new_work: s === "available",
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", plumberId);
      if (result.error && /column|schema cache/i.test(result.error.message)) {
        result = await supabase.from("plumbers").update({ availability_status: s }).eq("id", plumberId);
      }
      if (result.error) {
        setStatus(previous);
        setConfirmed(previousConfirmed);
        setError("Status could not be updated.");
      }
    });
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
        Current Status
      </div>
      <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
        {STATES.map((s) => (
          <button
            key={s.key}
            onClick={() => set(s.key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              status === s.key ? s.active : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {s.label}
          </button>
        ))}
      </div>
      <p className={`mt-1.5 text-[11px] ${status === "available" && !confirmed ? "font-semibold text-amber-700" : "text-gray-500"}`}>
        {status === "available" && !confirmed
          ? "Click Available to confirm that you are taking new work."
          : "Availability is time-sensitive. Update it whenever your workload changes."}
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
