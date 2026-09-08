import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import { AccessError, requireAdmin } from "@/lib/server-access";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Admin workspace | KZN Plumbers",robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};

export default async function AdminPage(){
  try{await requireAdmin();}
  catch(error){
    if(error instanceof AccessError && error.status===401)redirect("/login?next=%2Fadmin");
    const message=error instanceof AccessError?error.message:"Administrator tools are unavailable. Check the server-side Supabase configuration in Vercel; never put a service-role key in a public variable.";
    return<section className="mx-auto max-w-3xl px-6 py-14"><h1 className="text-3xl font-bold">Admin access unavailable</h1><p className="mt-4 text-slate-600">{message}</p><Link href="/login?next=%2Fadmin" className="btn-primary mt-6">Sign in with an authorised admin account</Link></section>;
  }
  return<Suspense fallback={<p role="status" className="p-10 text-slate-500">Loading admin workspace…</p>}><AdminWorkspace/></Suspense>;
}
