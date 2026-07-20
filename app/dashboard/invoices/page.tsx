"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";
import { formatRand } from "@/lib/utils";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  status: "draft" | "sent" | "paid";
  created_at: string;
};

export default function InvoicesPage() {
  const { user, authChecking } = useAuthGate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plumberId, setPlumberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const { data: plumber } = await supabase
        .from("plumbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!plumber || !mounted) {
        setLoading(false);
        return;
      }

      setPlumberId(plumber.id);

      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total, status, created_at")
        .eq("plumber_id", plumber.id)
        .order("created_at", { ascending: false });

      if (mounted) {
        setInvoices((data ?? []) as Invoice[]);
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [user]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-600",
      sent: "bg-blue-100 text-blue-700",
      paid: "bg-green-100 text-green-800",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl">Invoices</h1>
            <p className="text-gray-500 text-sm">Create and manage invoices for your customers</p>
          </div>
          {plumberId && (
            <Link href="/dashboard/invoices/new" className="btn-primary text-sm">
              + New Invoice
            </Link>
          )}
        </div>

        {!plumberId ? (
          <div className="panel text-center py-12">
            <p className="text-gray-500">Complete your business profile first to use invoices.</p>
            <Link href="/register" className="btn-primary mt-4 inline-block">
              Set up my business →
            </Link>
          </div>
        ) : invoices.length === 0 ? (
          <div className="panel text-center py-12">
            <div className="text-4xl mb-3">🧾</div>
            <div className="font-display text-xl font-bold mb-2">No invoices yet</div>
            <p className="text-sm text-gray-500 mb-4">
              Create your first invoice to send to a customer.
            </p>
            <Link href="/dashboard/invoices/new" className="btn-primary">
              Create first invoice
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Invoice #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-3">{inv.customer_name}</td>
                      <td className="px-4 py-3 font-semibold">{formatRand(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(inv.created_at).toLocaleDateString("en-ZA")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="text-xs text-brand hover:underline font-semibold"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
