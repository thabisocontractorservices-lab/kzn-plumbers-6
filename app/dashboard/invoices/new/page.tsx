"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { useInvoiceBusiness } from "@/lib/useInvoiceBusiness";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import type { Invoice } from "@/lib/invoice";
import Link from "next/link";

function NewInvoiceInner() {
  const { user, authChecking } = useAuthGate();
  const { business, loading } = useInvoiceBusiness(user);
  const fromId = useSearchParams().get("from");
  const [copyFrom, setCopyFrom] = useState<Invoice | null>(null);
  const [copyLoading, setCopyLoading] = useState(Boolean(fromId));

  useEffect(() => {
    if (!fromId || !business) return;
    (async () => {
      const { data } = await supabase.from("invoices").select("*").eq("id", fromId).eq("plumber_id", business.id).maybeSingle();
      // A copy gets a new number, today's date and no paid status — only the customer, items and notes carry over.
      setCopyFrom(data ? ({ ...(data as Invoice), invoice_date: null, due_date: null, status: "draft" }) : null);
      setCopyLoading(false);
    })();
  }, [fromId, business]);

  if (authChecking || loading || (fromId && copyLoading && business)) return <DashboardLoading />;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0">
        {business ? (
          <InvoiceForm business={business} copyFrom={copyFrom} />
        ) : (
          <div className="panel text-center py-12">
            <p className="text-gray-500">Complete your business profile first to use invoices.</p>
            <Link href="/register" className="btn-primary mt-4 inline-flex">Set up my business →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <NewInvoiceInner />
    </Suspense>
  );
}
