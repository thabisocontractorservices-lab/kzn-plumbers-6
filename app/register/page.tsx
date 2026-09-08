import { RegisterWizard } from "@/components/RegisterWizard";
import { getPublicSupabase } from "@/lib/supabase/public";

export const metadata = {
  title: "List Your Plumbing Business | KZN Plumbers Directory",
  description: "Submit a KwaZulu-Natal plumbing business for review or manage an existing listing.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

// Refresh the headline number every 10 minutes
export const revalidate = 600;

export default async function RegisterPage() {
  const supabase = getPublicSupabase();
  const { count } = supabase
    ? await supabase
        .from("plumbers")
        .select("id", { count: "exact", head: true })
        .eq("is_verified", true)
    : { count: 0 };

  const plumberCount = count ?? 0;
  // Round to nearest 10 for a cleaner social-proof line (e.g. 1,217 → "1,200+")
  const rounded = plumberCount >= 10
    ? Math.floor(plumberCount / 10) * 10
    : plumberCount;

  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center py-12 px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-floating p-10">
        <h1 className="font-display text-3xl text-center mb-1">
          List your plumbing business
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          Add your business to {rounded.toLocaleString()}+ published KZN directory records. Listing is free.
        </p>
        <RegisterWizard />
      </div>
    </div>
  );
}
