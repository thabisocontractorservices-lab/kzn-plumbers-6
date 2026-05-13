import { supabase } from "@/src/supabaseClient";
import { notFound } from "next/navigation";
import {
  combinedRating,
  formatRand,
  initials,
  whatsAppLink,
} from "@/lib/utils";
import { reviewUrl } from "@/lib/google/places";
import { BookingForm } from "@/components/BookingForm";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewLinkPanel } from "@/components/ReviewLinkPanel";

export const revalidate = 300; // 5 min

export default async function PlumberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Resolve by slug or UUID. We can't use .or(id.eq.X,slug.eq.X) because
  // Postgres errors when casting a non-UUID string to the uuid `id` column,
  // so detect the format first and pick the right column.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = UUID_RE.test(id);

  const baseQuery = supabase
    .from("plumbers")
    .select(
      `
      *,
      profile:profiles(full_name, email),
      certifications(*),
      photos(*),
      reviews(*),
      google_reviews(*)
    `,
    )
    .eq("is_verified", true);

  const { data: plumber } = await (
    isUuid ? baseQuery.eq("id", id) : baseQuery.eq("slug", id)
  ).single();

  if (!plumber) notFound();

  const r = combinedRating(
    plumber.google_rating,
    plumber.google_review_count,
    (plumber.ratings as { internal_rating?: number })?.internal_rating,
    (plumber.ratings as { internal_count?: number })?.internal_count,
  );

  const profilePhoto =
    (plumber.photos as Array<{ photo_url: string; is_profile_photo: boolean }>)
      ?.find((p) => p.is_profile_photo)
      ?.photo_url ?? null;

  const workPhotos =
    (plumber.photos as Array<{ photo_url: string; is_profile_photo: boolean }>)
      ?.filter((p) => !p.is_profile_photo) ?? [];

  const reviewLink = plumber.google_place_id
    ? reviewUrl(plumber.google_place_id)
    : null;

  return (
    <>
      {/* Banner */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <a href="/" className="text-sm opacity-80 hover:opacity-100 underline">
            ← Back to directory
          </a>
          <div className="flex gap-6 items-start mt-4">
            <div
              className="w-24 h-24 rounded-2xl bg-white text-brand flex items-center justify-center font-display text-4xl font-bold shadow-floating shrink-0"
              style={
                profilePhoto
                  ? { backgroundImage: `url(${profilePhoto})`, backgroundSize: "cover" }
                  : undefined
              }
            >
              {!profilePhoto && initials(plumber.trading_name)}
            </div>
            <div>
              <h1 className="font-display text-4xl mb-1">{plumber.trading_name}</h1>
              <div className="opacity-90 mb-3">
                📍 {plumber.area}
                {plumber.hourly_rate
                  ? ` · ${formatRand(plumber.hourly_rate)}/hr`
                  : " · Contact for quote"}
                {plumber.pirb_number && ` · ${plumber.pirb_number}`}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plumber.is_certified && (
                  <span className="badge bg-teal-light text-teal">✓ PIRB Certified</span>
                )}
                <span className={`badge ${availabilityClass(plumber.availability_status)}`}>
                  ● {plumber.availability_status}
                </span>
                {plumber.is_emergency && (
                  <span className="badge bg-emergency-light text-emergency">🚨 24/7 Emergency</span>
                )}
                {plumber.is_verified && (
                  <span className="badge bg-brand-light text-brand">★ Verified</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-5">
          {plumber.about && (
            <Panel title="About">
              <p className="text-gray-700 leading-relaxed">{plumber.about}</p>
            </Panel>
          )}

          <Panel title="Specialties">
            <div className="flex flex-wrap gap-2">
              {(plumber.specialties as string[]).map((s: string) => (
                <span
                  key={s}
                  className="px-3 py-1.5 bg-brand-light text-brand rounded-lg text-sm font-semibold"
                >
                  {s}
                </span>
              ))}
            </div>
          </Panel>

          {(plumber.certifications as Array<{ id: string; cert_name: string; cert_file_url: string }>)?.length > 0 && (
            <Panel title="Certifications & Credentials">
              <div className="flex flex-col gap-2">
                {(
                  plumber.certifications as Array<{
                    id: string;
                    cert_name: string;
                    cert_file_url: string;
                  }>
                ).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-lg bg-teal-light text-teal flex items-center justify-center text-lg shrink-0">
                      📜
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {c.cert_name}
                      </div>
                    </div>
                    <a
                      href={c.cert_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      View PDF
                    </a>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {workPhotos.length > 0 && (
            <Panel title="Recent Work">
              <div className="grid grid-cols-3 gap-2">
                {workPhotos.slice(0, 9).map((p, i) => (
                  <a
                    key={i}
                    href={p.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg bg-cover bg-center hover:scale-[1.02] transition-transform"
                    style={{ backgroundImage: `url(${p.photo_url})` }}
                  />
                ))}
              </div>
            </Panel>
          )}

          {/* Google My Business section */}
          {plumber.google_place_id && (
            <Panel title="Google My Business Reviews">
              <div className="flex items-center gap-5 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl mb-4">
                <div className="font-display text-4xl font-bold text-gray-900 leading-none">
                  {plumber.google_rating ?? "—"}
                </div>
                <div className="flex-1">
                  <div className="text-amber-500 text-lg tracking-wide">★★★★★</div>
                  <div className="text-xs text-gray-600">
                    Based on <strong>{plumber.google_review_count ?? 0}</strong> reviews on{" "}
                    <strong className="text-blue-600">Google</strong>
                  </div>
                </div>
                <a
                  href={reviewLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Write a Google Review
                </a>
              </div>

              <div className="flex flex-col">
                {(plumber.google_reviews as Array<{
                  id: string;
                  reviewer_name: string;
                  rating: number;
                  text: string | null;
                  review_time: string | null;
                }> ?? []).slice(0, 5).map((r) => (
                  <div key={r.id} className="py-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-xs">
                        {r.reviewer_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <strong className="text-sm">{r.reviewer_name}</strong>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">
                        Google
                      </span>
                      {r.review_time && (
                        <span className="ml-auto text-xs text-gray-500">
                          {new Date(r.review_time).toLocaleDateString("en-ZA")}
                        </span>
                      )}
                    </div>
                    <div className="text-amber-500 text-xs tracking-wide mb-1">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </div>
                    {r.text && <p className="text-sm text-gray-700 leading-relaxed">{r.text}</p>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Customer Reviews on KZN Plumbers">
            <p className="text-sm text-gray-500 mb-4">
              Verified reviews from this platform
            </p>
            <ReviewForm plumberId={plumber.id} />
            <div className="mt-6">
              {(plumber.reviews as Array<{
                id: string;
                reviewer_name: string;
                rating: number;
                comment: string | null;
                created_at: string;
              }> ?? []).map((r) => (
                <div key={r.id} className="py-4 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-semibold text-xs">
                      {r.reviewer_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <strong className="text-sm">{r.reviewer_name}</strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-light text-brand font-semibold">
                      Internal
                    </span>
                    <span className="ml-auto text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString("en-ZA")}
                    </span>
                  </div>
                  <div className="text-amber-500 text-xs tracking-wide mb-1">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </div>
                  {r.comment && <p className="text-sm text-gray-700 leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <div id="book" className="panel sticky top-20">
            <div className="flex gap-2 mb-4">
              <a
                href={whatsAppLink(
                  plumber.whatsapp_number,
                  `Hi, I found ${plumber.trading_name} on kznplumbers.co.za`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp flex-1"
              >
                💬 WhatsApp
              </a>
              <a href={`tel:${plumber.whatsapp_number}`} className="btn-secondary">
                📞 Call
              </a>
            </div>

            <h3 className="font-display text-lg font-bold mb-1">Book an Appointment</h3>
            <p className="text-xs text-gray-500 mb-4">
              Saves to bookings · sends WhatsApp notification
            </p>

            <BookingForm
              plumberId={plumber.id}
              plumberWhatsApp={plumber.whatsapp_number}
              plumberName={plumber.trading_name}
            />

            {plumber.google_calendar_url && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm font-semibold mb-2">Or use Google Calendar</div>
                <a
                  href={plumber.google_calendar_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full"
                >
                  📅 Check Live Availability
                </a>
              </div>
            )}
          </div>

          {reviewLink && (
            <ReviewLinkPanel reviewUrl={reviewLink} plumberName={plumber.trading_name} />
          )}
        </aside>
      </div>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <h2 className="font-display text-xl font-bold mb-4 text-gray-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function availabilityClass(status: string) {
  return {
    available: "bg-green-100 text-green-800",
    busy: "bg-amber-light text-amber",
    unavailable: "bg-red-100 text-red-800",
  }[status] ?? "bg-gray-100 text-gray-700";
}
