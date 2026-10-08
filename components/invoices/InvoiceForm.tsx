"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, Loader2, Percent, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/src/supabaseClient";
import { downloadInvoicePdf, saveInvoice } from "@/lib/invoice-client";
import type { InvoiceBusiness } from "@/lib/useInvoiceBusiness";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import {
  COMMON_SERVICES,
  PAYMENT_TERM_OPTIONS,
  addDays,
  computeTotals,
  formatRand,
  lineTotal,
  nextInvoiceNumber,
  toDateInput,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
} from "@/lib/invoice";

type ItemRow = { key: number; description: string; quantity: string; unit_price: string };
type Customer = { name: string; address: string; phone: string; email: string };

let rowKey = 0;
const blankRow = (): ItemRow => ({ key: ++rowKey, description: "", quantity: "1", unit_price: "" });
const toRow = (l: LineItem): ItemRow => ({ key: ++rowKey, description: l.description, quantity: String(l.quantity), unit_price: l.unit_price ? String(l.unit_price) : "" });
const num = (v: string) => {
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type Props = {
  business: InvoiceBusiness;
  /** Invoice being edited. */
  editing?: Invoice | null;
  /** Invoice being duplicated (copied into a new invoice). */
  copyFrom?: Invoice | null;
};

export function InvoiceForm({ business, editing, copyFrom }: Props) {
  const router = useRouter();
  const source = editing ?? copyFrom ?? null;
  const today = toDateInput(new Date());

  const [history, setHistory] = useState<Invoice[]>([]);
  const [ready, setReady] = useState(false);

  // Business (remembered from the last invoice)
  const [businessAddress, setBusinessAddress] = useState(source?.business_address ?? "");
  const [businessEmail, setBusinessEmail] = useState(source?.business_email ?? "");
  const [vatNumber, setVatNumber] = useState(source?.vat_number ?? "");
  const [showBusinessEdit, setShowBusinessEdit] = useState(false);

  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState(editing?.invoice_number ?? "");
  const [invoiceDate, setInvoiceDate] = useState(editing ? (editing.invoice_date || editing.created_at.slice(0, 10)) : today);
  const initialTerms = source?.payment_terms_days ?? 7;
  const [terms, setTerms] = useState<string>(
    editing && editing.due_date && editing.payment_terms_days == null ? "custom" : String(initialTerms),
  );
  const [dueDate, setDueDate] = useState(editing?.due_date ?? addDays(today, initialTerms));
  const [reference, setReference] = useState(editing?.reference ?? "");

  // Customer
  const [customer, setCustomer] = useState<Customer>({
    name: source?.customer_name ?? "",
    address: source?.customer_address ?? "",
    phone: source?.customer_phone ?? "",
    email: source?.customer_email ?? "",
  });

  // Items & totals
  const [rows, setRows] = useState<ItemRow[]>(() => (source?.line_items?.length ? source.line_items.map(toRow) : [blankRow()]));
  const [includeVat, setIncludeVat] = useState(source?.include_vat ?? false);
  const [discountText, setDiscountText] = useState(source?.discount_amount ? String(source.discount_amount) : "");
  const [showDiscount, setShowDiscount] = useState(Boolean(source?.discount_amount));

  // Notes
  const [noteTab, setNoteTab] = useState<"notes" | "footer">("notes");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [footerNote, setFooterNote] = useState(source?.footer_note ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "save" | "download">(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load past invoices: next number, saved customers, remembered business & bank details.
  useEffect(() => {
    let mounted = true;
    (async () => {
      let list: Invoice[] = [];
      try {
        const { data } = await supabase
          .from("invoices")
          .select("*")
          .eq("plumber_id", business.id)
          .order("created_at", { ascending: false })
          .limit(500);
        list = (data ?? []) as Invoice[];
      } catch {
        // Offline / temporary error: still let the plumber fill in the invoice.
        // The unique invoice-number rule in the database stops accidental duplicates.
      }
      if (!mounted) return;
      setHistory(list);
      if (!editing) {
        setInvoiceNumber(nextInvoiceNumber(list.map((i) => i.invoice_number)));
        const last = list[0];
        if (last && !copyFrom) {
          setBusinessAddress((v) => v || last.business_address || "");
          setBusinessEmail((v) => v || last.business_email || "");
          setVatNumber((v) => v || last.vat_number || "");
          setFooterNote((v) => v || last.footer_note || "");
          setIncludeVat((v) => v || Boolean(last.include_vat));
        }
      }
      setReady(true);
    })();
    return () => { mounted = false; };
  }, [business.id, editing, copyFrom]);

  // Keep the due date in step with the invoice date + payment terms.
  useEffect(() => {
    if (terms !== "custom") setDueDate(addDays(invoiceDate, Number(terms)));
  }, [invoiceDate, terms]);

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const inv of history) {
      const key = inv.customer_name.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, { name: inv.customer_name, address: inv.customer_address ?? "", phone: inv.customer_phone ?? "", email: inv.customer_email ?? "" });
    }
    return [...map.values()];
  }, [history]);

  const knownPrices = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of history) for (const l of inv.line_items || []) {
      const key = l.description.trim().toLowerCase();
      if (key && !map.has(key) && l.unit_price > 0) map.set(key, l.unit_price);
    }
    return map;
  }, [history]);

  const descriptionOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of [...history.flatMap((i) => (i.line_items || []).map((l) => l.description)), ...COMMON_SERVICES]) {
      const k = d.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(d.trim()); }
    }
    return out.slice(0, 80);
  }, [history]);

  const items: LineItem[] = rows.map((r) => ({ description: r.description.trim(), quantity: num(r.quantity), unit_price: num(r.unit_price) }));
  const filledItems = items.filter((i) => i.description || i.unit_price > 0);
  const discount = showDiscount ? num(discountText) : 0;
  const totals = computeTotals(filledItems, includeVat, discount);

  function pickCustomer(name: string) {
    const match = customers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setCustomer((c) => (match ? { name: match.name, address: c.address || match.address, phone: c.phone || match.phone, email: c.email || match.email } : { ...c, name }));
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((list) => list.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      if (patch.description !== undefined && !r.unit_price) {
        const price = knownPrices.get(patch.description.trim().toLowerCase());
        if (price) next.unit_price = String(price);
      }
      return next;
    }));
  }

  function clearForm() {
    if (!window.confirm("Clear the customer and all items?")) return;
    setCustomer({ name: "", address: "", phone: "", email: "" });
    setRows([blankRow()]);
    setDiscountText("");
    setShowDiscount(false);
    setNotes("");
    setReference("");
    setErrors({});
    setFormError(null);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!customer.name.trim()) e.customer = "Enter the customer's name.";
    if (!invoiceNumber.trim()) e.number = "Enter an invoice number.";
    if (!invoiceDate) e.date = "Choose the invoice date.";
    if (filledItems.length === 0) e.items = "Add at least one item with a description and price.";
    filledItems.forEach((item) => {
      if (!item.description) e.items = "Every item needs a description.";
      else if (item.quantity <= 0) e.items = `Quantity for “${item.description}” must be more than 0.`;
      else if (item.unit_price <= 0) e.items = `Enter a price for “${item.description}”.`;
    });
    if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email.trim())) e.email = "That email address doesn't look right.";
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields.");
      document.getElementById(Object.keys(e)[0] === "items" ? "items" : `field-${Object.keys(e)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    setFormError(null);
    return true;
  }

  async function submit(andDownload: boolean) {
    if (!validate()) return;
    setSaving(andDownload ? "download" : "save");

    const status: InvoiceStatus = editing
      ? (andDownload && editing.status === "draft" ? "sent" : editing.status)
      : (andDownload ? "sent" : "draft");

    const payload: Record<string, unknown> = {
      plumber_id: business.id,
      invoice_number: invoiceNumber.trim(),
      customer_name: customer.name.trim(),
      customer_address: customer.address.trim() || null,
      customer_phone: customer.phone.trim() || null,
      customer_email: customer.email.trim() || null,
      line_items: filledItems,
      subtotal: totals.subtotal,
      vat_amount: totals.vat,
      total: totals.total,
      include_vat: includeVat,
      notes: notes.trim() || null,
      status,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      payment_terms_days: terms === "custom" ? null : Number(terms),
      discount_amount: totals.discount,
      reference: reference.trim() || null,
      footer_note: footerNote.trim() || null,
      business_address: businessAddress.trim() || null,
      business_email: businessEmail.trim() || null,
      vat_number: vatNumber.trim() || null,
    };

    try {
      const { id, usedLegacySchema } = await saveInvoice(payload, editing?.id);
      const params = new URLSearchParams({ saved: "1" });
      if (usedLegacySchema) params.set("legacy", "1");
      if (andDownload) {
        try {
          await downloadInvoicePdf({ id, invoice_number: invoiceNumber.trim(), customer_name: customer.name.trim() });
          params.set("dl", "ok");
        } catch {
          params.set("dl", "fail");
        }
      }
      router.push(`/dashboard/invoices/${id}?${params.toString()}`);
      router.refresh();
    } catch (err) {
      setSaving(null);
      setFormError((err as Error).message);
      if (/invoice number/i.test((err as Error).message)) setErrors((e) => ({ ...e, number: "Already used." }));
    }
  }

  const previewInvoice = {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    reference,
    customer_name: customer.name,
    customer_address: customer.address,
    customer_phone: customer.phone,
    customer_email: customer.email,
    line_items: filledItems.length ? filledItems : items,
    include_vat: includeVat,
    discount_amount: discount,
    notes,
    footer_note: footerNote,
    business_address: businessAddress,
    business_email: businessEmail,
    vat_number: vatNumber,
    status: (editing?.status ?? "draft") as InvoiceStatus,
  };

  const initials = business.trading_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const label = "block text-xs font-semibold text-gray-600 mb-1";
  const err = (k: string) => (errors[k] ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "");

  return (
    <div className="pb-28">
      <div className="mb-5">
        <Link href={editing ? `/dashboard/invoices/${editing.id}` : "/dashboard/invoices"} className="text-sm text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {editing ? "Back to invoice" : "Back to invoices"}
        </Link>
        <h1 className="font-display text-3xl mt-1">{editing ? `Edit ${editing.invoice_number}` : copyFrom ? "New invoice (copy)" : "New invoice"}</h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(true); }} noValidate>
        {/* ── 1. From / invoice details ───────────────────────────────── */}
        <section className="panel mb-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-start gap-4">
                {business.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo
                  <img src={business.logo_url} alt="" className="w-20 h-20 rounded-lg object-contain border border-gray-200 shrink-0" />
                ) : (
                  <Link href="/dashboard/uploads" className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs flex flex-col items-center justify-center text-center shrink-0 hover:border-brand hover:text-brand">
                    <span className="text-lg font-bold text-brand">{initials}</span>+ Add logo
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-lg leading-tight">{business.trading_name}</p>
                  <p className="text-sm text-gray-500 whitespace-pre-line">{businessAddress || business.area}</p>
                  <p className="text-sm text-gray-500">{business.whatsapp_number}</p>
                  <button type="button" onClick={() => setShowBusinessEdit((v) => !v)} className="text-xs text-brand font-semibold hover:underline mt-1">
                    {showBusinessEdit ? "Done" : "Edit business address, email & VAT no."}
                  </button>
                </div>
              </div>
              {showBusinessEdit && (
                <div className="grid gap-3 mt-4 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className={label} htmlFor="biz-address">Business address</label>
                    <textarea id="biz-address" rows={2} className="input" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder={business.area} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={label} htmlFor="biz-email">Business email</label>
                      <input id="biz-email" type="email" className="input" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="Optional" />
                    </div>
                    <div>
                      <label className={label} htmlFor="biz-vat">VAT number</label>
                      <input id="biz-vat" className="input" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="Only if VAT registered" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">These are remembered for your next invoice.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 content-start">
              <div id="field-number">
                <label className={label} htmlFor="inv-number">Invoice number</label>
                <input id="inv-number" className={`input ${err("number")}`} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={ready ? "" : "Loading…"} />
                {errors.number && <p className="text-xs text-red-600 mt-1">{errors.number}</p>}
              </div>
              <div id="field-date">
                <label className={label} htmlFor="inv-date">Date</label>
                <input id="inv-date" type="date" className={`input ${err("date")}`} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="inv-terms">Payment terms</label>
                <select id="inv-terms" className="input" value={terms} onChange={(e) => setTerms(e.target.value)}>
                  {PAYMENT_TERM_OPTIONS.map((t) => <option key={t.days} value={String(t.days)}>{t.label}</option>)}
                  <option value="custom">Pick a date</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="inv-due">Due date</label>
                <input id="inv-due" type="date" className="input" value={dueDate} onChange={(e) => { setTerms("custom"); setDueDate(e.target.value); }} />
              </div>
              <div className="col-span-2">
                <label className={label} htmlFor="inv-ref">Reference / order no. <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="inv-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. PO-2231 or job address" />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Customer ─────────────────────────────────────────────── */}
        <section className="panel mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Bill to</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div id="field-customer">
              <label className={label} htmlFor="cust-name">Customer name *</label>
              <input
                id="cust-name"
                list="customer-list"
                className={`input ${err("customer")}`}
                value={customer.name}
                onChange={(e) => pickCustomer(e.target.value)}
                placeholder={customers.length ? "Type or pick a past customer" : "e.g. Thabiso Ndlovu"}
                autoComplete="off"
              />
              <datalist id="customer-list">{customers.map((c) => <option key={c.name} value={c.name} />)}</datalist>
              {errors.customer && <p className="text-xs text-red-600 mt-1">{errors.customer}</p>}
            </div>
            <div>
              <label className={label} htmlFor="cust-phone">Phone / WhatsApp</label>
              <input id="cust-phone" type="tel" inputMode="tel" className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="082 123 4567" />
            </div>
            <div>
              <label className={label} htmlFor="cust-address">Address</label>
              <textarea id="cust-address" rows={2} className="input" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Street, suburb, town" />
            </div>
            <div id="field-email">
              <label className={label} htmlFor="cust-email">Email</label>
              <input id="cust-email" type="email" inputMode="email" className={`input ${err("email")}`} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Optional" />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
          </div>
        </section>

        {/* ── 3. Items ────────────────────────────────────────────────── */}
        <section id="items" className={`panel mb-4 !p-0 ${errors.items ? "ring-2 ring-red-300" : ""}`}>
          <div className="hidden sm:grid grid-cols-[70px_1fr_130px_120px_36px] gap-2 bg-gray-600 text-white text-xs font-semibold px-4 py-2.5">
            <span>Qty</span><span>Description</span><span className="text-right">Unit price (R)</span><span className="text-right">Total</span><span />
          </div>
          <datalist id="service-list">{descriptionOptions.map((d) => <option key={d} value={d} />)}</datalist>
          <ul className="divide-y divide-gray-100">
            {rows.map((row, index) => (
              <li key={row.key} className="grid grid-cols-[64px_1fr_auto] sm:grid-cols-[70px_1fr_130px_120px_36px] gap-2 px-4 py-3 items-center">
                <input
                  aria-label={`Quantity for item ${index + 1}`}
                  className="input text-center px-2 row-start-2 sm:row-start-auto"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                />
                <input
                  aria-label={`Description for item ${index + 1}`}
                  list="service-list"
                  className="input col-span-2 sm:col-span-1 row-start-1 sm:row-start-auto col-start-1 sm:col-start-auto"
                  value={row.description}
                  onChange={(e) => updateRow(row.key, { description: e.target.value })}
                  placeholder="What did you do? e.g. Drain cleaning"
                />
                <div className="row-start-2 sm:row-start-auto">
                  <input
                    aria-label={`Unit price for item ${index + 1}`}
                    className="input text-right"
                    inputMode="decimal"
                    value={row.unit_price}
                    onChange={(e) => updateRow(row.key, { unit_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <p className="hidden sm:block text-right font-semibold text-sm">{formatRand(lineTotal({ quantity: num(row.quantity), unit_price: num(row.unit_price) }))}</p>
                <button
                  type="button"
                  onClick={() => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== row.key) : [blankRow()]))}
                  className="row-start-1 sm:row-start-auto col-start-3 sm:col-start-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <p className="sm:hidden row-start-2 col-start-3 text-right text-sm font-semibold self-center whitespace-nowrap min-w-[80px]">{formatRand(lineTotal({ quantity: num(row.quantity), unit_price: num(row.unit_price) }))}</p>
              </li>
            ))}
          </ul>
          {errors.items && <p className="text-sm text-red-600 px-4 pb-2">{errors.items}</p>}
          <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100">
            <button type="button" onClick={() => setRows((r) => [...r, blankRow()])} className="btn-primary py-2">
              <Plus className="w-4 h-4" /> Add item
            </button>
            {!showDiscount && (
              <button type="button" onClick={() => setShowDiscount(true)} className="btn-secondary py-2">
                <Percent className="w-4 h-4" /> Add discount
              </button>
            )}
          </div>
        </section>

        {/* ── 4. Notes + totals ──────────────────────────────────────── */}
        <section className="grid md:grid-cols-[1fr_320px] gap-4 mb-4">
          <div className="panel !p-0">
            <div className="flex border-b border-gray-200 text-sm" role="tablist">
              {([["notes", "Note to customer"], ["footer", "Banking / payment details"]] as const).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={noteTab === key}
                  onClick={() => setNoteTab(key)}
                  className={`px-4 py-3 font-medium border-b-2 -mb-px ${noteTab === key ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-800"}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="p-4">
              {noteTab === "notes" ? (
                <textarea rows={4} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 6-month guarantee on workmanship. Parts replaced: …" />
              ) : (
                <>
                  <textarea rows={4} className="input" value={footerNote} onChange={(e) => setFooterNote(e.target.value)} placeholder={"Bank: FNB\nAccount name: …\nAccount no: …\nBranch code: 250655\nUse the invoice number as reference"} />
                  <p className="text-xs text-gray-500 mt-1">Saved for your next invoice automatically.</p>
                </>
              )}
            </div>
          </div>

          <div className="panel space-y-2 text-sm self-start">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">{formatRand(totals.subtotal)}</span></div>
            {showDiscount && (
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="discount" className="text-gray-600">Discount (R)</label>
                <div className="flex items-center gap-1">
                  <input id="discount" inputMode="decimal" className="input w-28 text-right py-1.5" value={discountText} onChange={(e) => setDiscountText(e.target.value)} placeholder="0.00" />
                  <button type="button" onClick={() => { setShowDiscount(false); setDiscountText(""); }} className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove discount"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
              <span className="flex items-center gap-2 text-gray-600">
                <input type="checkbox" className="w-4 h-4 accent-brand" checked={includeVat} onChange={(e) => setIncludeVat(e.target.checked)} />
                Add VAT (15%)
              </span>
              <span className="font-medium">{formatRand(totals.vat)}</span>
            </label>
            <div className="flex justify-between text-lg font-bold border-t-2 border-gray-900 pt-2"><span>Total</span><span>{formatRand(totals.total)}</span></div>
            {!includeVat && <p className="text-xs text-gray-400">Only tick VAT if you are VAT registered.</p>}
          </div>
        </section>

        {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{formError}</p>}

        {/* ── Sticky action bar ───────────────────────────────────────── */}
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 lg:pl-[calc(240px+3rem)]">
            <div className="hidden sm:block mr-auto">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold leading-tight">{formatRand(totals.total)}</p>
            </div>
            <button type="button" onClick={clearForm} className="btn-secondary hidden md:inline-flex">Clear</button>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary" aria-label="Preview invoice"><Eye className="w-4 h-4" /><span className="hidden sm:inline">Preview</span></button>
            <button type="button" onClick={() => submit(false)} disabled={saving !== null || !ready} className="btn-secondary disabled:opacity-60" aria-label={editing ? "Save" : "Save draft"}>
              {saving === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">{editing ? "Save" : "Save draft"}</span>
            </button>
            <button type="submit" disabled={saving !== null || !ready} className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex-1 sm:flex-none px-5 py-3">
              {saving === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {saving === "download" ? "Saving…" : "Save & Download PDF"}
            </button>
          </div>
        </div>
      </form>

      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Invoice preview" onClick={() => setPreviewOpen(false)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2 text-white">
              <p className="font-semibold">Preview — this is what your customer will see</p>
              <button onClick={() => setPreviewOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close preview"><X className="w-5 h-5" /></button>
            </div>
            <div className="rounded-xl overflow-hidden shadow-2xl">
              <InvoicePreview invoice={previewInvoice} business={business} />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setPreviewOpen(false)} className="btn-secondary">Keep editing</button>
              <button onClick={() => { setPreviewOpen(false); submit(true); }} className="btn bg-green-600 text-white hover:bg-green-700">
                <Download className="w-4 h-4" /> Save &amp; Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
