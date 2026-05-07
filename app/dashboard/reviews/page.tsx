"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { reviewUrl } from "@/lib/google/places";
import { useAuthGate } from "@/lib/useAuthGate";
import { ReviewLinkSection } from "@/components/ReviewLinkSection";
import { DashboardLoading } from "@/components/DashboardLoading";

type Plumber = {
  id: string;
  slug: string | null;
  trading_name: string;
  google_place_id: string | null;
};

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  text: string | null;
};

export default function ReviewsPage() {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [plumber, setPlumber] = useState<Plumber | null>(null);
  const [internalReviews, setInternalReviews] = useState<Review[]>([]);
  const [googleReviews, setGoogleReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const { data: p } = await supabase
        .from("plumbers")
        .select("id, slug, trading_name, google_place_id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      if (!p) {
        router.replace("/register");
        return;
      }
      setPlumber(p as Plumber);

      const [internalRes, googleRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("*")
          .eq("plumber_id", p.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("google_reviews")
          .select("*")
          .eq("plumber_id", p.id)
          .order("review_time", { ascending: false }),
      ]);

      if (!mounted) return;
      setInternalReviews((internalRes.data as Review[]) ?? []);
      setGoogleReviews((googleRes.data as Review[]) ?? []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user || !plumber) return null;

  const link = plumber.google_place_id ? reviewUrl(plumber.google_place_id) : null;
  const shortLink = `${typeof window !== "undefined" ? window.location.origin : ""}/review/${plumber.slug ?? plumber.id}`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl mb-1">Reviews</h1>
        <p className="text-gray-500 text-sm">
          Your Google + internal reviews, plus your shareable review link.
        </p>
      </div>

      {link ? (
        <ReviewLinkSection reviewUrl={link} shortUrl={shortLink} plumberName={plumber.trading_name} />
      ) : (
        <div className="panel">
          <p className="text-sm text-gray-600">
            Add a Google Place ID in{" "}
            <a href="/dashboard/profile" className="text-brand underline">
              your profile
            </a>{" "}
            to unlock the review link & QR code feature.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title={`Google Reviews (${googleReviews.length})`}>
          {googleReviews.length === 0 ? (
            <p className="text-sm text-gray-500">
              No Google reviews synced yet. They'll refresh daily once a Place ID is set.
            </p>
          ) : (
            googleReviews.map((r) => (
              <div key={r.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-sm">{r.reviewer_name}</strong>
                  <span className="text-amber-500 text-sm">{"★".repeat(r.rating)}</span>
                </div>
                {r.text && <p className="text-sm text-gray-700">{r.text}</p>}
              </div>
            ))
          )}
        </Section>

        <Section title={`Internal Reviews (${internalReviews.length})`}>
          {internalReviews.length === 0 ? (
            <p className="text-sm text-gray-500">No internal reviews yet.</p>
          ) : (
            internalReviews.map((r) => (
              <div key={r.id} className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-sm">{r.reviewer_name}</strong>
                  <span className="text-amber-500 text-sm">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2 className="font-display text-xl font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}
