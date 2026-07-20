"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import Link from "next/link";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

type InvoiceData = {
  id: string;
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
  status: "draft" | "sent" | "paid";
  created_at: string;
};

type PlumberInfo = {
  trading_name: string;
  area: string;
  whatsapp_number: string;
  pirb_number: string | null;
  profile_photo_url: string | null;
};

export default function ViewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [plumber, setPlumber] = useState<PlumberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceId, setInvoiceId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setInvoiceId(p.id));
  }, [params]);

  useEffect(() => {
    if (!user || !invoiceId) return;
    let mounted = true;

    (async () => {
      // Get plumber info
      const { data: plumberData } = await supabase
        .from("plumbers")
        .select("id, trading_name, area, whatsapp_number, pirb_number")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!plumberData || !mounted) {
        setLoading(false);
        return;
      }

      // Get profile photo
      const { data: photoData } = await supabase
        .from("photos")
        .select("photo_url")
        .eq("plumber_id", plumberData.id)
        .eq("is_profile_photo", true)
        .maybeSingle();

      setPlumber({
        trading_name: plumberData.trading_name,
        area: plumberData.area,
        whatsapp_number: plumberData.whatsapp_number,
        pirb_number: plumberData.pirb_number,
        profile_photo_url: photoData?.photo_url ?? null,
      });

      // Get invoice
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("plumber_id", plumberData.id)
        .single();

      if (mounted) {
        setInvoice(invoiceData as InvoiceData | null);
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [user, invoiceId]);

  async function updateStatus(status: "draft" | "sent" | "paid") {
    if (!invoice) return;
    await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoice.id);
    setInvoice({ ...invoice, status });
  }

  function printInvoice() {
    window.print();
  }

  const formatRand = (amount: number) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(amount);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user || !invoice || !plumber) return null;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-600",
      sent: "bg-blue-100 text-blue-700",
      paid: "bg-green-100 text-green-800",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <>
      {/* Dashboard layout — hidden when printing */}
      <div className="print:hidden max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
        <DashboardNav />
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <Link href="/dashboard/invoices" className="text-sm text-brand hover:underline mb-1 inline-block">
                ← Back to invoices
              </Link>
              <h1 className="font-display text-3xl">{invoice.invoice_number}</h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={printInvoice} className="btn-primary text-sm">
                📄 Download PDF
              </button>
              {invoice.status === "draft" && (
                <button onClick={() => updateStatus("sent")} className="btn-secondary text-sm">
                  Mark as Sent
                </button>
              )}
              {invoice.status === "sent" && (
                <button onClick={() => updateStatus("paid")} className="btn-secondary text-sm bg-green-50 text-green-700 border-green-200">
                  Mark as Paid ✓
                </button>
              )}
              {invoice.status === "paid" && (
                <span className="badge bg-green-100 text-green-800 text-sm px-3 py-1.5">✓ Paid</span>
              )}
            </div>
          </div>

          {/* Invoice preview (also used for print) */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8" id="invoice-content">
            <InvoiceContent invoice={invoice} plumber={plumber} formatRand={formatRand} statusBadge={statusBadge} />
          </div>
        </div>
      </div>

      {/* Print-only version */}
      <div className="hidden print:block p-8">
        <InvoiceContent invoice={invoice} plumber={plumber} formatRand={formatRand} statusBadge={statusBadge} />
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 1cm; }
        }
      `}</style>
    </>
  );
}

function InvoiceContent({
  invoice,
  plumber,
  formatRand,
  statusBadge,
}: {
  invoice: InvoiceData;
  plumber: PlumberInfo;
  formatRand: (n: number) => string;
  statusBadge: (s: string) => string;
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {plumber.profile_photo_url ? (
            <div
              className="w-16 h-16 rounded-xl bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${plumber.profile_photo_url})` }}
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-xl shrink-0">
              {plumber.trading_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
            </div>
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">
              {plumber.trading_name}
            </h2>
            <p className="text-sm text-gray-500">📍 {plumber.area}</p>
            {plumber.pirb_number && (
              <p className="text-xs text-gray-400">PIRB: {plumber.pirb_number}</p>
            )}
            <p className="text-xs text-gray-400">📞 {plumber.whatsapp_number}</p>
          </div>
        </div>
        <div className="text-right">
          <h3 className="font-display text-2xl font-bold text-gray-900">INVOICE</h3>
          <p className="text-sm text-gray-600 font-semibold">{invoice.invoice_number}</p>
          <p className="text-xs text-gray-500 mt-1">
            Date: {new Date(invoice.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge(invoice.status)}`}>
            {invoice.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Bill to */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Bill to</p>
        <p className="font-semibold text-gray-900">{invoice.customer_name}</p>
        {invoice.customer_address && <p className="text-sm text-gray-600">{invoice.customer_address}</p>}
        {invoice.customer_phone && <p className="text-sm text-gray-600">📞 {invoice.customer_phone}</p>}
        {invoice.customer_email && <p className="text-sm text-gray-600">✉️ {invoice.customer_email}</p>}
      </div>

      {/* Line items table */}
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 font-semibold text-gray-700">Description</th>
            <th className="text-center py-2 font-semibold text-gray-700 w-20">Qty</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-28">Unit Price</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-3">{item.description}</td>
              <td className="py-3 text-center">{item.quantity}</td>
              <td className="py-3 text-right">{formatRand(item.unit_price)}</td>
              <td className="py-3 text-right font-medium">{formatRand(item.quantity * item.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold">{formatRand(invoice.subtotal)}</span>
          </div>
          {invoice.include_vat && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT (15%)</span>
              <span className="font-semibold">{formatRand(invoice.vat_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
            <span>Total</span>
            <span>{formatRand(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Generated by {plumber.trading_name} via kznplumbers.co.za
        </p>
      </div>
    </div>
  );
}
