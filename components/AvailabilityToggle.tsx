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
}: {
  plumberId: string;
  initial: Status;
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [, startTransition] = useTransition();

  function set(s: Status) {
    setStatus(s);
    startTransition(async () => {
      await supabase
        .from("plumbers")
        .update({ availability_status: s })
        .eq("id", plumberId);
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
    </div>
  );
}
