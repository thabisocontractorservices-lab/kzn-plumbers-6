"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { useInvoiceBusiness } from "@/lib/useInvoiceBusiness";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { InvoiceActions } from "@/components/invoices/InvoiceActions";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { Toast, useToast } from "@/components/invoices/Toast";
import { invoicePdfUrl } from "@/lib/invoice-client";
import { STATUS_STYLES, displayStatus, formatInvoiceDate, formatRand, invoiceFilename, type Invoice } from "@/lib/invoice";

function ViewInvoiceInner({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { user, authChecking } = useAuthGate();
  const { business, loading } = useInvoiceBusiness(user);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const { toast, show, clear } = useToast();

  const saved = search.get("saved") === "1";
  const dl = search.get("dl");
  const legacy = search.get("legacy") === "1";

  useEffect(() => {
    if (loading) return;
    if (!business) { setInvoiceLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("invoices").select("*").eq("id", id).eq("plumber_id", business.id).maybeSingle();
      setInvoice((data as Invoice) ?? null);
      setInvoiceLoading(false);
    })();
  }, [id, business, loading]);

  if (authChecking || loading || invoiceLoading) return <DashboardLoading />;
  if (!user) return null;

  if (!business || !invoice) {
    return (
      <Shell>
        <div className="panel text-center py-12">
          <p className="text-gray-500 mb-4">This invoice could not be found.</p>
          <Link href="/dashboard/invoices" className="btn-primary inline-flex">Back to invoices</Link>
        </div>
      </Shell>
    );
  }

  const status = displayStatus(invoice);

  return (
    <Shell>
      <Link href="/dashboard/invoices" className="text-sm text-brand hover:underline inline-flex items-center gap-1 mb-2">
        <ArrowLeft className="w-4 h-4" /> All invoices
      </Link>

      {saved && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 text-sm ${dl === "fail" ? "bg-amber-light text-amber" : "bg-teal-light text-teal"}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {dl === "ok" ? `Invoice saved and downloaded as “${invoiceFilename(invoice)}”.` : dl === "fail" ? "Invoice saved, but the download didn't start." : "Invoice saved."}
            </p>
            <p>
              {dl === "ok" ? "Check your Downloads folder (on iPhone: tap Share → Save to Files). " : null}
              Didn&apos;t get it?{" "}
              <a href={invoicePdfUrl(invoice.id)} download={invoiceFilename(invoice)} className="underline font-semibold">Tap here to download the PDF</a>.
            </p>
          </div>
        </div>
      )}
      {legacy && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4 text-sm bg-brand-light text-brand-dark">
          <Info className="w-5 h-5 shrink-0" />
          <p>Saved. Due date, discount, banking details and business address will be stored once the site owner runs the latest database update.</p>
        </div>
      )}

      <div className="panel mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl">{invoice.invoice_number}</h1>
              <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>
            </div>
            <p className="text-gray-600 text-sm mt-1">
              {invoice.customer_name} · <span className="font-semibold text-gray-900">{formatRand(invoice.total)}</span>
              {invoice.due_date && status !== "Paid" ? <> · due {formatInvoiceDate(invoice.due_date)}</> : null}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <InvoiceActions
            variant="page"
            invoice={invoice}
            businessName={business.trading_name}
            onUpdated={setInvoice}
            onDeleted={() => router.push("/dashboard/invoices")}
            onMessage={show}
          />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <InvoicePreview invoice={invoice} business={business} />
      </div>
      <Toast toast={toast} onClose={clear} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function ViewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<DashboardLoading />}>
      <ViewInvoiceInner id={id} />
    </Suspense>
  );
}
