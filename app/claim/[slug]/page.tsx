import { supabase } from "@/src/supabaseClient";
import { notFound } from "next/navigation";
import { initials, formatRand } from "@/lib/utils";
import { ClaimFlow } from "@/components/ClaimFlow";

export const revalidate = 300;

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: plumber } = await supabase
    .from("plumbers")
    .select("id, slug, trading_name, area, specialties, hourly_rate, google_rating, google_review_count, is_certified, is_emergency, pirb_number, whatsapp_number, profile_id")
    .eq("slug", slug)
    .eq("is_verified", true)
    .single();

  if (!plumber) notFound();

  // Already claimed
  const isClaimed = !!plumber.profile_id;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-8 sm:py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <a href="/" className="text-xs sm:text-sm opacity-80 hover:opacity-100 underline">
            ← Back to directory
          </a>
          <div className="mt-6 mb-4 flex justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white text-brand flex items-center justify-center font-display text-3xl sm:text-4xl font-bold shadow-floating">
              {initials(plumber.trading_name)}
            </div>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold mb-2">
            {isClaimed ? "Already Claimed" : "Is this your business?"}
          </h1>
          <p className="text-base sm:text-lg opacity-90 mb-1">
            {plumber.trading_name}
          </p>
          <p className="text-sm opacity-75">
            📍 {plumber.area}
            {plumber.hourly_rate ? ` · ${formatRand(plumber.hourly_rate)}/hr` : ""}
            {plumber.pirb_number ? ` · ${plumber.pirb_number}` : ""}
          </p>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {isClaimed ? (
          <div className="panel text-center py-10">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-display text-xl font-bold mb-2">
              This listing has already been claimed
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              If you believe this is an error, please contact us at{" "}
              <a
                href="mailto:thabisocontractorservices@gmail.com"
                className="text-brand underline"
              >
                thabisocontractorservices@gmail.com
              </a>
            </p>
            <a href={`/plumber/${plumber.slug ?? plumber.id}`} className="btn-primary">
              View listing →
            </a>
          </div>
        ) : (
          <ClaimFlow
            plumberId={plumber.id}
            plumberSlug={plumber.slug}
            tradingName={plumber.trading_name}
            area={plumber.area}
            maskedPhone={maskPhone(plumber.whatsapp_number)}
          />
        )}
      </div>
    </>
  );
}

/** Mask the phone number for display: 0XX XXX XX** */
function maskPhone(phone: string): string {
  if (!phone) return "***";
  const digits = phone.replace(/\D/g, "");
  // Show first 5 digits, mask the rest
  if (digits.length <= 5) return "***";
  const visible = digits.startsWith("27")
    ? "0" + digits.slice(2, 5)
    : digits.slice(0, 5);
  return visible + " *** **" + digits.slice(-2);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: plumber } = await supabase
    .from("plumbers")
    .select("trading_name, area")
    .eq("slug", slug)
    .single();

  if (!plumber) return { title: "Claim Your Listing — KZN Plumbers" };

  return {
    title: `Claim ${plumber.trading_name} — KZN Plumbers`,
    description: `Are you ${plumber.trading_name} in ${plumber.area}? Claim your free listing on KZN Plumbers to manage your profile, respond to enquiries, and get more customers.`,
  };
}
