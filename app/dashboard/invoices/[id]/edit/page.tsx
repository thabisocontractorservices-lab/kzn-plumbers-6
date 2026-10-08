"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { useInvoiceBusiness } from "@/lib/useInvoiceBusiness";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import type { Invoice } from "@/lib/invoice";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, authChecking } = useAuthGate();
  const { business, loading } = useInvoiceBusiness(user);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div className="min-w-0">
        {business && invoice ? (
          <InvoiceForm key={invoice.id} business={business} editing={invoice} />
        ) : (
          <div className="panel text-center py-12">
            <p className="text-gray-500 mb-4">This invoice could not be found.</p>
            <Link href="/dashboard/invoices" className="btn-primary inline-flex">Back to invoices</Link>
          </div>
        )}
      </div>
    </div>
  );
}
