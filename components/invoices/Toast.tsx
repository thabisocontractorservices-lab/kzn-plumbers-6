"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export type ToastState = { message: string; tone: "success" | "error" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, tone: "success" | "error" = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), tone === "error" ? 7000 : 4000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, show, clear: () => setToast(null) };
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const error = toast.tone === "error";
  return (
    <div role="status" aria-live="polite" className="fixed z-50 bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md">
      <div className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white ${error ? "bg-red-600" : "bg-gray-900"}`}>
        {error ? <XCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />}
        <span className="flex-1">{toast.message}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}
