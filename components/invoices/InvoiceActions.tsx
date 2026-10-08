"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Download, Eye, Loader2, Pencil, Send, Share2, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/src/supabaseClient";
import { downloadInvoicePdf, shareInvoicePdf, viewInvoicePdf } from "@/lib/invoice-client";
import type { Invoice, InvoiceStatus } from "@/lib/invoice";

type Props = {
  invoice: Invoice;
  businessName: string;
  onUpdated?: (invoice: Invoice) => void;
  onDeleted?: (id: string) => void;
  onMessage?: (message: string, tone?: "success" | "error") => void;
  /** "row" = list row (small), "page" = invoice page header (large, extra buttons visible). */
  variant?: "row" | "page";
};

export function InvoiceActions({ invoice, businessName, onUpdated, onDeleted, onMessage, variant = "row" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "download" | "share" | "status" | "delete">(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const say = (m: string, tone: "success" | "error" = "success") => onMessage?.(m, tone);

  async function handleDownload() {
    setBusy("download");
    try {
      await downloadInvoicePdf(invoice);
      say(`Invoice ${invoice.invoice_number} downloaded.`);
    } catch (e) {
      say((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setOpen(false);
    setBusy("share");
    try {
      const result = await shareInvoicePdf(invoice, businessName);
      if (result === "downloaded") say("PDF downloaded — attach it in the WhatsApp chat that just opened.");
      if (result === "shared") say("Invoice shared.");
      if (invoice.status === "draft" && result !== "cancelled") await setStatus("sent", true);
    } catch (e) {
      say((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: InvoiceStatus, quiet = false) {
    setOpen(false);
    setBusy("status");
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoice.id);
    setBusy(null);
    if (error) return say("Could not update the status. Please try again.", "error");
    onUpdated?.({ ...invoice, status });
    if (!quiet) say(status === "paid" ? "Marked as paid." : status === "sent" ? "Marked as sent (unpaid)." : "Moved back to draft.");
  }

  async function handleDelete() {
    setOpen(false);
    if (!window.confirm(`Delete invoice ${invoice.invoice_number} for ${invoice.customer_name}? This cannot be undone.`)) return;
    setBusy("delete");
    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
    setBusy(null);
    if (error) return say("Could not delete the invoice. Please try again.", "error");
    say(`Invoice ${invoice.invoice_number} deleted.`);
    onDeleted?.(invoice.id);
  }

  const large = variant === "page";
  const item = "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-gray-700 hover:bg-brand-light hover:text-brand-dark";

  return (
    <div className={`flex items-center gap-2 ${large ? "flex-wrap" : "justify-end"}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className={`btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 ${large ? "px-5 py-3 text-base" : "px-3 py-2 text-xs"}`}
        aria-label={`Download invoice ${invoice.invoice_number} as PDF`}
      >
        {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy === "download" ? "Preparing…" : "Download PDF"}
      </button>

      {large && (
        <>
          <button type="button" onClick={() => viewInvoicePdf(invoice.id)} className="btn-secondary py-3">
            <Eye className="w-4 h-4" /> View PDF
          </button>
          <button type="button" onClick={handleShare} disabled={busy !== null} className="btn-whatsapp py-3 disabled:opacity-60">
            {busy === "share" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Send to customer
          </button>
        </>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`btn-secondary ${large ? "py-3" : "px-2.5 py-2 text-xs"}`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {busy && busy !== "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          More <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 animate-slideDown">
            {!large && (
              <>
                <button role="menuitem" className={item} onClick={() => { setOpen(false); viewInvoicePdf(invoice.id); }}><Eye className="w-4 h-4" /> View PDF</button>
                <button role="menuitem" className={item} onClick={handleShare}><Share2 className="w-4 h-4" /> Send to customer</button>
                <Link role="menuitem" className={item} href={`/dashboard/invoices/${invoice.id}`}><Eye className="w-4 h-4" /> Open invoice</Link>
              </>
            )}
            <Link role="menuitem" className={item} href={`/dashboard/invoices/${invoice.id}/edit`}><Pencil className="w-4 h-4" /> Edit</Link>
            {invoice.status !== "paid" && <button role="menuitem" className={item} onClick={() => setStatus("paid")}><Check className="w-4 h-4" /> Mark as paid</button>}
            {invoice.status === "draft" && <button role="menuitem" className={item} onClick={() => setStatus("sent")}><Send className="w-4 h-4" /> Mark as sent</button>}
            {invoice.status === "paid" && <button role="menuitem" className={item} onClick={() => setStatus("sent")}><Undo2 className="w-4 h-4" /> Mark as unpaid</button>}
            <button role="menuitem" className={item} onClick={() => { setOpen(false); router.push(`/dashboard/invoices/new?from=${invoice.id}`); }}><Copy className="w-4 h-4" /> Duplicate</button>
            <div className="my-1 border-t border-gray-100" />
            <button role="menuitem" className={`${item} text-red-600 hover:bg-red-50 hover:text-red-700`} onClick={handleDelete}><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
