import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminLeads } from "@/components/leads/AdminLeads";
import { AccessError, requireAdmin } from "@/lib/server-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads | KZN Plumbers admin", robots: { index: false, follow: false } };

export default async function AdminLeadsPage() {
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect("/login?next=%2Fadmin%2Fleads");
    return <section className="mx-auto max-w-3xl px-6 py-14"><h1 className="text-3xl font-bold">Admin access unavailable</h1><p className="mt-4 text-slate-600">{error instanceof AccessError ? error.message : "Administrator tools are unavailable."}</p><Link href="/login?next=%2Fadmin%2Fleads" className="btn-primary mt-6">Sign in</Link></section>;
  }
  return <Suspense fallback={<p className="p-10 text-slate-500">Loading leads…</p>}><AdminLeads /></Suspense>;
}
