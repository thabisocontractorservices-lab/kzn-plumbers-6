"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { ProfileEditor } from "@/components/ProfileEditor";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [plumber, setPlumber] = useState<Parameters<typeof ProfileEditor>[0]["plumber"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("plumbers")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!data) {
        router.replace("/register");
        return;
      }

      setPlumber(data);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user || !plumber) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div>
      <h1 className="font-display text-3xl mb-1">Edit profile</h1>
      <p className="text-gray-500 text-sm mb-6">
        Changes go live immediately on your public profile.
      </p>
      <ProfileEditor plumber={plumber} />
      </div>
    </div>
  );
}
