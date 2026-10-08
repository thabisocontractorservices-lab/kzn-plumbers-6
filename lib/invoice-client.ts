"use client";

import { supabase } from "@/src/supabaseClient";
import { formatInvoiceDate, formatRand, invoiceFilename, type Invoice } from "@/lib/invoice";
import { formatWhatsApp } from "@/lib/utils";

export function invoicePdfUrl(id: string, inline = false) {
  return `/api/invoices/${encodeURIComponent(id)}/pdf${inline ? "?inline=1" : ""}`;
}

async function fetchInvoicePdf(id: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(invoicePdfUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    let message = "The PDF could not be created. Please try again.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("The PDF came back empty. Please try again.");
  return blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
}

/**
 * Saves the invoice as a real .pdf file in the plumber's Downloads folder
 * (desktop + Android). On iPhone, Safari opens it with "Save to Files / Share".
 * Never opens the print dialog.
 */
export async function downloadInvoicePdf(invoice: Pick<Invoice, "id" | "invoice_number" | "customer_name">) {
  const blob = await fetchInvoicePdf(invoice.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = invoiceFilename(invoice);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opens the PDF in a new tab (uses the session cookie, so it works as a plain link). */
export function viewInvoicePdf(id: string) {
  window.open(invoicePdfUrl(id, true), "_blank", "noopener");
}

export function invoiceShareMessage(invoice: Pick<Invoice, "invoice_number" | "customer_name" | "total" | "due_date">, businessName: string) {
  const first = (invoice.customer_name || "").split(/\s+/)[0];
  const due = invoice.due_date ? ` Payment is due by ${formatInvoiceDate(invoice.due_date)}.` : "";
  return `Hi ${first || "there"}, here is invoice ${invoice.invoice_number} from ${businessName} for ${formatRand(invoice.total)}.${due} Thank you for your business.`;
}

/**
 * Mobile: opens the phone's share sheet with the PDF attached (WhatsApp, email, etc.).
 * Desktop / unsupported browsers: downloads the PDF and opens WhatsApp with a ready message.
 * Returns what happened so the UI can tell the plumber.
 */
export async function shareInvoicePdf(invoice: Invoice, businessName: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const text = invoiceShareMessage(invoice, businessName);
  const blob = await fetchInvoicePdf(invoice.id);
  const file = new File([blob], invoiceFilename(invoice), { type: "application/pdf" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Invoice ${invoice.invoice_number}`, text });
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
      // Share sheet refused (e.g. lost user gesture) — fall through to download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  const phone = invoice.customer_phone ? formatWhatsApp(invoice.customer_phone) : "";
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return "downloaded";
}

// ── Saving ──────────────────────────────────────────────────────────────────

/** Columns that exist on every deployment (before migration 008). */
const LEGACY_COLUMNS = [
  "plumber_id", "invoice_number", "customer_name", "customer_address", "customer_phone", "customer_email",
  "line_items", "subtotal", "vat_amount", "total", "include_vat", "notes", "status",
] as const;

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ["PGRST204", "42703"].includes(error.code || "") || /column .* does not exist|schema cache/i.test(error.message || "");
}

function legacyOnly(payload: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of LEGACY_COLUMNS) if (key in payload) out[key] = payload[key];
  return out;
}

export type SaveResult = { id: string; usedLegacySchema: boolean };

/**
 * Insert or update an invoice. If the database hasn't had migration 008 yet,
 * it retries with the original columns so plumbers are never blocked.
 */
export async function saveInvoice(payload: Record<string, unknown>, existingId?: string): Promise<SaveResult> {
  const run = async (body: Record<string, unknown>) => {
    if (existingId) {
      const { data, error } = await supabase.from("invoices").update(body).eq("id", existingId).select("id").single();
      return { id: data?.id as string | undefined, error };
    }
    const { data, error } = await supabase.from("invoices").insert(body).select("id").single();
    return { id: data?.id as string | undefined, error };
  };

  let result = await run(payload);
  let usedLegacySchema = false;
  if (result.error && isMissingColumn(result.error)) {
    usedLegacySchema = true;
    result = await run(legacyOnly(payload));
  }
  if (result.error) {
    if (result.error.code === "23505") throw new Error("That invoice number is already used. Please choose a different number.");
    throw new Error(result.error.message || "The invoice could not be saved.");
  }
  if (!result.id) throw new Error("The invoice could not be saved.");
  return { id: result.id, usedLegacySchema };
}
