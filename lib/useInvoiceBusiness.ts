"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/supabaseClient";
import type { BusinessInfo } from "@/lib/invoice";

export type InvoiceBusiness = BusinessInfo & { id: string };

/** Loads the signed-in plumber's business details + logo for invoices. */
export function useInvoiceBusiness(user: { id: string } | null) {
  const [business, setBusiness] = useState<InvoiceBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data: plumber } = await supabase
        .from("plumbers")
        .select("id, trading_name, area, whatsapp_number, pirb_number")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (!plumber) {
        setBusiness(null);
        setLoading(false);
        return;
      }
      const { data: photo } = await supabase
        .from("photos")
        .select("photo_url")
        .eq("plumber_id", plumber.id)
        .eq("is_profile_photo", true)
        .maybeSingle();
      if (!mounted) return;
      setBusiness({
        id: plumber.id,
        trading_name: plumber.trading_name,
        area: plumber.area,
        whatsapp_number: plumber.whatsapp_number,
        pirb_number: plumber.pirb_number,
        logo_url: photo?.photo_url ?? null,
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user]);

  return { business, loading };
}
