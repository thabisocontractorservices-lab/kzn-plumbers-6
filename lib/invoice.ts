// Shared invoice types and pure helpers. Safe to import from client components,
// server route handlers and the PDF renderer alike (no server-only imports).

export const VAT_RATE = 0.15;

export type InvoiceStatus = "draft" | "sent" | "paid";

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type Invoice = {
  id: string;
  plumber_id: string;
  invoice_number: string;
  customer_name: string;
  customer_address: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  line_items: LineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  include_vat: boolean;
  notes: string | null;
  status: InvoiceStatus;
  created_at: string;
  // Added by migration 008 — optional so older rows / un-migrated databases still work.
  invoice_date?: string | null;
  due_date?: string | null;
  payment_terms_days?: number | null;
  discount_amount?: number | null;
  reference?: string | null;
  footer_note?: string | null;
  business_address?: string | null;
  business_email?: string | null;
  vat_number?: string | null;
  updated_at?: string | null;
};

export type BusinessInfo = {
  trading_name: string;
  area: string;
  whatsapp_number: string;
  pirb_number: string | null;
  logo_url: string | null;
};

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
};

/** Round to cents without floating-point drift (e.g. 0.1 + 0.2). */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100;
}

export function lineTotal(item: Pick<LineItem, "quantity" | "unit_price">): number {
  return roundMoney((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
}

/** Subtotal → minus discount → plus VAT (VAT is charged on the discounted amount). */
export function computeTotals(items: LineItem[], includeVat: boolean, discount = 0): InvoiceTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const safeDiscount = Math.min(Math.max(roundMoney(discount), 0), subtotal);
  const taxable = roundMoney(subtotal - safeDiscount);
  const vat = includeVat ? roundMoney(taxable * VAT_RATE) : 0;
  return { subtotal, discount: safeDiscount, taxable, vat, total: roundMoney(taxable + vat) };
}

/** R5,750.00 — matches the invoice layout plumbers already send (and is identical on server and client). */
export function formatRand(amount: number): string {
  const value = roundMoney(amount);
  const sign = value < 0 ? "-" : "";
  const [whole, cents] = Math.abs(value).toFixed(2).split(".");
  return `${sign}R${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/**
 * Next invoice number for a plumber, based on the highest number already used
 * (not a row count, so deleting an invoice never produces a duplicate).
 * Keeps the prefix and zero-padding of the most recent style, e.g. INV-0009 → INV-0010.
 */
export function nextInvoiceNumber(existing: string[]): string {
  let best: { prefix: string; num: number; width: number } | null = null;
  for (const raw of existing) {
    const match = /^(.*?)(\d+)\s*$/.exec((raw || "").trim());
    if (!match) continue;
    const num = Number(match[2]);
    if (!best || num > best.num) best = { prefix: match[1], num, width: match[2].length };
  }
  if (!best) return "INV-0001";
  return `${best.prefix}${String(best.num + 1).padStart(best.width, "0")}`;
}

/** yyyy-mm-dd in local time (what <input type="date"> expects). */
export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateInput: string, days: number): string {
  const [y, m, d] = dateInput.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + (Number(days) || 0));
  return toDateInput(date);
}

/** Display a yyyy-mm-dd (or ISO timestamp) as 2026/10/08 — the format plumbers see on the PDF. */
export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return value;
  return datePart.replace(/-/g, "/");
}

export function invoiceDateOf(invoice: Pick<Invoice, "invoice_date" | "created_at">): string {
  return (invoice.invoice_date || invoice.created_at || "").slice(0, 10);
}

export function isOverdue(invoice: Pick<Invoice, "status" | "due_date">, today = toDateInput(new Date())): boolean {
  return invoice.status === "sent" && Boolean(invoice.due_date) && String(invoice.due_date) < today;
}

export type DisplayStatus = "Draft" | "Unpaid" | "Overdue" | "Paid";

export function displayStatus(invoice: Pick<Invoice, "status" | "due_date">, today?: string): DisplayStatus {
  if (invoice.status === "paid") return "Paid";
  if (invoice.status === "draft") return "Draft";
  return isOverdue(invoice, today) ? "Overdue" : "Unpaid";
}

export const STATUS_STYLES: Record<DisplayStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Unpaid: "bg-amber-light text-amber",
  Overdue: "bg-red-100 text-red-700",
  Paid: "bg-teal-light text-teal",
};

/** Balance still owed — zero once marked paid. */
export function balanceDue(invoice: Pick<Invoice, "status" | "total">): number {
  return invoice.status === "paid" ? 0 : roundMoney(invoice.total);
}

/** "Invoice INV-0004 - Thabiso Ndlovu.pdf" with characters that break downloads removed. */
export function invoiceFilename(invoice: Pick<Invoice, "invoice_number" | "customer_name">): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const number = clean(invoice.invoice_number || "Invoice") || "Invoice";
  const customer = clean(invoice.customer_name || "").slice(0, 60);
  return `Invoice ${number}${customer ? ` - ${customer}` : ""}.pdf`;
}

/** ASCII-only fallback for the Content-Disposition header (RFC 6266 also sends filename*). */
export function asciiFilename(name: string): string {
  return name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "'") || "invoice.pdf";
}

export const PAYMENT_TERM_OPTIONS: { label: string; days: number }[] = [
  { label: "Due on receipt", days: 0 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

export const COMMON_SERVICES = [
  "Call-out fee",
  "Labour (per hour)",
  "Burst pipe repair",
  "Blocked drain clearing",
  "Drain cleaning",
  "Geyser replacement",
  "Geyser element replacement",
  "Geyser thermostat replacement",
  "Leak detection",
  "Toilet repair",
  "Tap replacement",
  "Water heater installation",
  "Plumbing Certificate of Compliance (CoC)",
  "Materials",
];
