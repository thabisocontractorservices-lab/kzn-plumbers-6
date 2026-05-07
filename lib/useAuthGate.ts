"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";

type AuthUser = { id: string; email: string };

/**
 * Client-side auth gate for protected pages.
 *
 * - Reads the current session from localStorage (via supabase.auth.getSession()).
 * - Redirects to /login if no session.
 * - If `requireAdmin: true`, also checks profiles.role === 'admin' and
 *   redirects to /dashboard if not.
 * - Subscribes to onAuthStateChange so logout in any tab redirects this tab too.
 *
 * Returns:
 *   user           — { id, email } once the session is verified, otherwise null
 *   authChecking   — true while the gate is doing its initial check
 */
export function useAuthGate(opts?: { requireAdmin?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      if (opts?.requireAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single<{ role: string }>();
        if (profile?.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
      }

      if (mounted) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
        setAuthChecking(false);
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, opts?.requireAdmin]);

  return { user, authChecking };
}
