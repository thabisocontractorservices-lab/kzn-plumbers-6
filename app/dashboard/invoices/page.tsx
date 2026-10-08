"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { useInvoiceBusiness } from "@/lib/useInvoiceBusiness";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { InvoiceActions } from "@/components/invoices/InvoiceActions";
import { Toast, useToast } from "@/components/invoices/Toast";
import {
  STATUS_STYLES,
  balanceDue,
  displayStatus,
  formatInvoiceDate,
  formatRand,
  invoiceDateOf,
  toDateInput,
  type DisplayStatus,
  type Invoice,
} from "@/lib/invoice";

const FILTERS: ("All" | DisplayStatus)[] = ["All", "Unpaid", "Overdue", "Paid", "Draft"];

export default function InvoicesPage() {
  const { user, authChecking } = useAuthGate();
  const { business, loading: businessLoading } = useInvoiceBusiness(user);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const { toast, show, clear } = useToast();

  useEffect(() => {
    if (businessLoading) return;
    if (!business) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("plumber_id", business.id)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) setLoadError("Your invoices could not be loaded. Please refresh the page.");
      setInvoices((data ?? []) as Invoice[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [business, businessLoading]);

  const today = toDateInput(new Date());
  const monthPrefix = today.slice(0, 7);

  const summary = useMemo(() => {
    let owed = 0, overdue = 0, overdueCount = 0, paidThisMonth = 0;
    for (const inv of invoices) {
      const status = displayStatus(inv, today);
      if (status === "Unpaid" || status === "Overdue") owed += balanceDue(inv);
      if (status === "Overdue") { overdue += balanceDue(inv); overdueCount++; }
      if (status === "Paid" && (inv.updated_at || invoiceDateOf(inv)).slice(0, 7) === monthPrefix) paidThisMonth += Number(inv.total) || 0;
    }
    return { owed, overdue, overdueCount, paidThisMonth };
  }, [invoices, today, monthPrefix]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter !== "All" && displayStatus(inv, today) !== filter) return false;
      if (!q) return true;
      const haystack = [inv.invoice_number, inv.customer_name, inv.customer_phone, inv.customer_email, ...(inv.line_items || []).map((l) => l.description)]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, query, filter, today]);

  if (authChecking || businessLoading || loading) return <DashboardLoading />;
  if (!user) return null;

  const updateOne = (next: Invoice) => setInvoices((list) => list.map((i) => (i.id === next.id ? next : i)));
  const removeOne = (id: string) => setInvoices((list) => list.filter((i) => i.id !== id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="font-display text-3xl">Invoices</h1>
            <p className="text-gray-500 text-sm">Create an invoice, download the PDF, and send it to your customer.</p>
          </div>
          {business && (
            <Link href="/dashboard/invoices/new" className="btn bg-green-600 text-white hover:bg-green-700 px-5 py-3">
              <Plus className="w-4 h-4" /> New Invoice
            </Link>
          )}
        </div>

        {!business ? (
          <div className="panel text-center py-12">
            <p className="text-gray-500">Complete your business profile first to use invoices.</p>
            <Link href="/register" className="btn-primary mt-4 inline-flex">Set up my business →</Link>
          </div>
        ) : invoices.length === 0 ? (
          <div className="panel text-center py-14">
            <div className="text-5xl mb-3">🧾</div>
            <h2 className="font-display text-xl font-bold mb-2">No invoices yet</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              Fill in the customer, add the work you did, and tap <strong>Save &amp; Download</strong>. You&apos;ll get a PDF ready to send.
            </p>
            <Link href="/dashboard/invoices/new" className="btn bg-green-600 text-white hover:bg-green-700 px-5 py-3">
              <Plus className="w-4 h-4" /> Create your first invoice
            </Link>
            {loadError && <p className="text-sm text-red-600 mt-4">{loadError}</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <SummaryCard label="Waiting to be paid" value={formatRand(summary.owed)} tone="text-amber" />
              <SummaryCard
                label="Overdue"
                value={formatRand(summary.overdue)}
                hint={summary.overdueCount ? `${summary.overdueCount} invoice${summary.overdueCount > 1 ? "s" : ""}` : "Nothing overdue"}
                tone={summary.overdueCount ? "text-red-600" : "text-gray-900"}
              />
              <SummaryCard label="Paid this month" value={formatRand(summary.paidThisMonth)} tone="text-teal" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <label className="relative flex-1">
                <span className="sr-only">Search invoices</span>
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input pl-9"
                  placeholder="Search customer, invoice number or work done…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="Filter by status">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
                      filter === f ? "bg-brand text-white border-brand" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="panel text-center py-10 text-sm text-gray-500">No invoices match your search.</div>
            ) : (
              <>
                {/* Desktop / tablet table */}
                <div className="hidden md:block bg-white border border-gray-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-600 text-white text-left">
                        <th className="px-4 py-3 font-semibold rounded-tl-xl">Date</th>
                        <th className="px-4 py-3 font-semibold">Number</th>
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold text-right">Amount</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right rounded-tr-xl">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((inv) => {
                        const status = displayStatus(inv, today);
                        return (
                          <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatInvoiceDate(invoiceDateOf(inv))}</td>
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/invoices/${inv.id}`} className="font-semibold text-brand hover:underline">{inv.invoice_number}</Link>
                            </td>
                            <td className="px-4 py-3 max-w-[220px] truncate">{inv.customer_name}</td>
                            <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatRand(inv.total)}</td>
                            <td className="px-4 py-3">
                              <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>
                              {status !== "Paid" && inv.due_date && <div className="text-[11px] text-gray-400 mt-0.5">Due {formatInvoiceDate(inv.due_date)}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <InvoiceActions invoice={inv} businessName={business.trading_name} onUpdated={updateOne} onDeleted={removeOne} onMessage={show} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phone cards */}
                <ul className="md:hidden space-y-3">
                  {visible.map((inv) => {
                    const status = displayStatus(inv, today);
                    return (
                      <li key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <Link href={`/dashboard/invoices/${inv.id}`} className="flex justify-between items-start gap-3 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{inv.customer_name}</p>
                            <p className="text-xs text-gray-500">{inv.invoice_number} · {formatInvoiceDate(invoiceDateOf(inv))}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold">{formatRand(inv.total)}</p>
                            <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>
                          </div>
                        </Link>
                        <InvoiceActions invoice={inv} businessName={business.trading_name} onUpdated={updateOne} onDeleted={removeOne} onMessage={show} />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
      <Toast toast={toast} onClose={clear} />
    </div>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
