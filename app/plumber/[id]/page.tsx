import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarDays, Clock3, ExternalLink, FileCheck2, Globe2, MapPin, MessageCircle, Phone, ShieldQuestion, Star } from "lucide-react";
import { BookingForm } from "@/components/BookingForm";
import { PlumberCard } from "@/components/PlumberCard";
import { ProfileViewTracker } from "@/components/ProfileViewTracker";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewLinkPanel } from "@/components/ReviewLinkPanel";
import { TrackedContactLink } from "@/components/TrackedContactLink";
import { getPublicPlumbers } from "@/lib/directory-data";
import { isIndexableProfile, usableProfileAbout } from "@/lib/content-quality";
import { safeJsonLd } from "@/lib/json-ld";
import { reviewUrl } from "@/lib/google/places";
import { regionForArea } from "@/lib/regions";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getPublicProfile, getPublicProfileReviews, getPublicGoogleReviews, getPublicCredentialLabels } from "@/lib/directory-profile";
import { directoryContact } from "@/lib/directory-contact";
import { formatRand, initials } from "@/lib/utils";
import { formattedVerificationDate, getVerificationState, isTakingWork, verificationDescription, verificationLabel, verificationTone } from "@/lib/verification";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const plumber = await getPublicProfile(id);
  if (!plumber) return { title: "Plumber not found | KZN Plumbers", robots: { index: false, follow: true } };
  const canonical = `/plumber/${plumber.slug ?? id}`;
  const services = (plumber.specialties ?? []).slice(0, 3).join(", ");
  const title = `${plumber.trading_name} — Plumber in ${plumber.area} | KZN Plumbers`;
  const about = usableProfileAbout(plumber.about);
  const indexable = isIndexableProfile(plumber);
  const description = about
    ? `${about.slice(0, 145)}${about.length > 145 ? "…" : ""}`
    : `${plumber.trading_name} directory profile for ${plumber.area}, KZN${services ? `, listing ${services}` : ""}. Check verification state and contact details.`;
  const profilePhoto = plumber.photos?.find((photo: { is_profile_photo: boolean }) => photo.is_profile_photo)?.photo_url;
  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, url: absoluteUrl(canonical), siteName: SITE_NAME, type: "profile", locale: "en_ZA", ...(profilePhoto ? { images: [{ url: profilePhoto }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(profilePhoto ? { images: [profilePhoto] } : {}) },
  };
}

export default async function PlumberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plumber = await getPublicProfile(id);
  if (!plumber) notFound();

  const state = getVerificationState(plumber);
  const profileAbout = usableProfileAbout(plumber.about);
  const stateDate = state === "credential_verified" ? formattedVerificationDate(plumber.credential_verified_at) : null;
  const takingWork = isTakingWork(plumber);
  const profilePhoto = plumber.photos?.find((photo: { is_profile_photo: boolean }) => photo.is_profile_photo)?.photo_url ?? null;
  const workPhotos = (plumber.photos ?? []).filter((photo: { is_profile_photo: boolean }) => !photo.is_profile_photo).slice(0, 9);
  const primaryService = plumber.specialties?.[0] ?? "plumbing work";
  const contactMessage = `Hi, I found ${plumber.trading_name} on kznplumbers.co.za and would like to get a quote for ${primaryService.toLowerCase()} in ${plumber.area}.`;
  const { telephone, whatsappHref: waLink, phoneHref: phoneLink } = directoryContact(plumber.whatsapp_number, contactMessage);
  const googleReviewLink = plumber.google_place_id ? reviewUrl(plumber.google_place_id) : null;
  const region = regionForArea(plumber.area);
  const [labelsResult, reviewsResult, googleResult, relatedResult] = await Promise.allSettled([
    getPublicCredentialLabels(plumber.id), getPublicProfileReviews(plumber.id),
    getPublicGoogleReviews(plumber.id), getPublicPlumbers({ areas: [plumber.area], limit: 5 }),
  ]);
  const certifications = labelsResult.status === "fulfilled" ? labelsResult.value : [];
  const internalReviews = reviewsResult.status === "fulfilled" ? reviewsResult.value.current : [];
  const firstPartySummary = reviewsResult.status === "fulfilled" && reviewsResult.value.available ? reviewsResult.value.summary : null;
  const reviewHistoryCount = reviewsResult.status === "fulfilled" ? reviewsResult.value.historicalCount : 0;
  const googleReviews = googleResult.status === "fulfilled" ? googleResult.value : [];
  const related = relatedResult.status === "fulfilled" ? relatedResult.value.plumbers.filter((item) => item.id !== plumber.id).slice(0, 3) : [];
  const googleRating = Number(plumber.google_rating);
  const googleCount = plumber.google_review_count;
  const hasGoogleRating = googleCount != null && googleCount > 0 && Number.isFinite(googleRating) && googleRating >= 1 && googleRating <= 5;
  const externalLinks = [
    { label: "Website", url: safeUrl(plumber.website_url) },
    { label: "Facebook", url: safeUrl(plumber.facebook_url) },
    { label: "Instagram", url: safeUrl(plumber.instagram_url) },
    { label: "TikTok", url: safeUrl(plumber.tiktok_url) },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  const canonical = `/plumber/${plumber.slug ?? plumber.id}`;
  const entityType = state === "directory_record" ? "Organization" : "Plumber";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": entityType,
      name: plumber.trading_name,
      url: absoluteUrl(canonical),
      ...(telephone ? { telephone } : {}),
      address: { "@type": "PostalAddress", addressLocality: plumber.area, addressRegion: "KwaZulu-Natal", addressCountry: "ZA" },
      areaServed: { "@type": "AdministrativeArea", name: `${plumber.area}, KwaZulu-Natal` },
      ...(profilePhoto ? { image: profilePhoto } : {}),
      ...(profileAbout ? { description: profileAbout } : {}),
      ...(externalLinks.length ? { sameAs: externalLinks.map((item) => item.url) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        ...(region ? [{ "@type": "ListItem", position: 2, name: region.name, item: absoluteUrl(`/plumbers/${region.slug}`) }] : []),
        { "@type": "ListItem", position: region ? 3 : 2, name: plumber.trading_name, item: absoluteUrl(canonical) },
      ],
    },
  ];

  const StateIcon = state === "credential_verified" ? BadgeCheck : state === "business_claimed" ? Building2 : ShieldQuestion;

  return (
    <>
      {jsonLd.map((item, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(item) }} />)}
      <ProfileViewTracker plumberId={plumber.id} area={plumber.area} />

      <header className="bg-slate-950 px-4 py-9 text-white sm:px-6 sm:py-12">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link><span aria-hidden="true">/</span>
            {region && <><Link href={`/plumbers/${region.slug}`} className="hover:text-white">{region.shortName}</Link><span aria-hidden="true">/</span></>}
            <span>{plumber.trading_name}</span>
          </nav>
          <div className="mt-6 flex items-start gap-4 sm:gap-6">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand sm:h-28 sm:w-28">
              {profilePhoto ? <Image src={profilePhoto} alt={`${plumber.trading_name} profile`} fill sizes="112px" className="object-cover" priority /> : <span className="flex h-full items-center justify-center font-display text-2xl font-bold">{initials(plumber.trading_name)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{plumber.trading_name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300 sm:text-base"><MapPin className="h-4 w-4" /> {plumber.area}{plumber.hourly_rate ? <span>· Listed rate {formatRand(plumber.hourly_rate)}/hour</span> : <span>· Written quote recommended</span>}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${verificationTone(state)}`}><StateIcon className="h-3.5 w-3.5" /> {verificationLabel(state)}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${takingWork ? "bg-emerald-100 text-emerald-900" : "bg-slate-700 text-slate-200"}`}><Clock3 className="h-3.5 w-3.5" /> {takingWork ? "Recently opted in · confirm" : "Confirm availability"}</span>
                {plumber.is_emergency && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">Emergency service listed</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          {phoneLink && !waLink ? (
            <TrackedContactLink href={phoneLink} kind="call_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-primary flex-1"><Phone className="h-4 w-4" /> Call</TrackedContactLink>
          ) : waLink && phoneLink ? (
            <>
              <TrackedContactLink href={waLink} kind="whatsapp_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-whatsapp flex-1" newWindow><MessageCircle className="h-4 w-4" /> WhatsApp</TrackedContactLink>
              <TrackedContactLink href={phoneLink} kind="call_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-secondary"><Phone className="h-4 w-4" /> Call</TrackedContactLink>
            </>
          ) : <span className="self-center text-sm text-slate-500">Phone not recorded</span>}
          <a href="#book" className="btn-secondary"><CalendarDays className="h-4 w-4" /> Contact</a>
        </div>
      </div>

      {!plumber.profile_id && (
        <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
            <Building2 className="h-6 w-6 shrink-0 text-amber-700" />
            <div className="flex-1"><h2 className="font-display text-lg font-bold text-slate-950">Is this your business?</h2><p className="text-sm text-slate-700">Claim requests are reviewed before profile control is transferred.</p></div>
            <Link href={`/claim/${plumber.slug ?? plumber.id}`} className="btn-primary">Request ownership review</Link>
          </div>
        </section>
      )}

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <section className={`rounded-2xl border p-5 ${verificationTone(state)}`}>
            <div className="flex items-center gap-2"><StateIcon className="h-5 w-5" /><h2 className="font-display text-xl font-bold">{verificationLabel(state)}</h2></div>
            <p className="mt-3 text-sm leading-relaxed">{verificationDescription(state)}</p>
            <p className="mt-2 text-xs">Directory publication is not an endorsement or a guarantee of availability.</p>
            {stateDate && <p className="mt-2 text-xs font-bold">Last evidence check: {stateDate}. Review period ends {formattedVerificationDate(plumber.verification_expires_at)}.</p>}
            {state === "credential_verified" && plumber.pirb_number && <p className="mt-2 text-sm font-semibold">Recorded PIRB number: {plumber.pirb_number}</p>}
            <Link href="/trust" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline">Read the method <ExternalLink className="h-3.5 w-3.5" /></Link>
          </section>

          {profileAbout ? (
            <Panel title="About this business"><p className="overflow-wrap-anywhere whitespace-pre-line text-sm leading-relaxed text-slate-700">{profileAbout}</p></Panel>
          ) : (
            <Panel title="About this business"><p className="text-sm leading-relaxed text-slate-600">A usable business description is not currently displayed. Use the listed services and trust state, then confirm the job details directly.</p></Panel>
          )}

          <Panel title="Listed services">
            {plumber.specialties?.length ? <div className="flex flex-wrap gap-2">{plumber.specialties.map((service: string) => <span key={service} className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-brand">{service}</span>)}</div> : <p className="text-sm text-slate-600">No services have been confirmed on this profile.</p>}
          </Panel>

          {labelsResult.status === "rejected" && <p role="alert" className="text-sm text-red-700">Public credential labels could not be loaded. No credential status is inferred from that error.</p>}

          {(plumber.pirb_number || plumber.sessa_number || plumber.lpgsa_number || certifications.length) && (
            <Panel title="Credentials recorded on the profile">
              <div className="space-y-3">
                {plumber.pirb_number && <CredentialRow name="PIRB number" value={plumber.pirb_number} checked={false} />}
                {plumber.sessa_number && <CredentialRow name="SESSA number" value={plumber.sessa_number} checked={false} />}
                {plumber.lpgsa_number && <CredentialRow name="LPGSA number" value={plumber.lpgsa_number} checked={false} />}
                {certifications.map((credential: { id: string; cert_name: string }) => <CredentialRow key={credential.id} name={credential.cert_name} value="Public credential label recorded" checked={false} />)}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">Private certificates are not published as public download links. Ask the business for current proof for your specific job.</p>
            </Panel>
          )}

          {externalLinks.length > 0 && <Panel title="Business links"><div className="flex flex-wrap gap-2">{externalLinks.map((item) => <a key={item.label} href={item.url} target="_blank" rel="noopener noreferrer" className="btn-secondary"><Globe2 className="h-4 w-4" /> {item.label}</a>)}</div></Panel>}

          {workPhotos.length > 0 && (
            <Panel title="Work photos">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{workPhotos.map((photo: { id?: string; photo_url: string; caption?: string | null }, index: number) => <a key={photo.id ?? index} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100"><Image src={photo.photo_url} alt={photo.caption || `${plumber.trading_name} work example ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover transition-transform group-hover:scale-105" /></a>)}</div>
            </Panel>
          )}

          {(plumber.google_place_id || hasGoogleRating) && (
            <Panel title="Google review summary">
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-amber-50 p-4"><Star className="h-6 w-6 fill-amber-400 text-amber-400" /><div><div className="font-display text-2xl font-bold text-slate-950">{hasGoogleRating ? googleRating.toFixed(1) : "Not recorded"}</div><div className="text-xs text-slate-600">{googleCount != null ? `${googleCount} reviews in the stored Google data` : "Google review count not recorded"}</div></div>{googleReviewLink && <a href={googleReviewLink} target="_blank" rel="noopener noreferrer" className="btn-secondary ml-auto">Open Google review form</a>}</div>
              <p className="mt-3 text-xs text-slate-500">Cached Google data, not a live rating. {formattedVerificationDate(plumber.google_reviews_synced_at) ? `Last sync: ${formattedVerificationDate(plumber.google_reviews_synced_at)}.` : "Sync date not recorded."}</p>
              {googleResult.status === "rejected" && <p role="alert" className="mt-2 text-sm text-red-700">Google review excerpts could not be loaded.</p>}
              <div className="mt-3 divide-y divide-slate-100">{googleReviews.slice(0, 5).map((review: { id: string; reviewer_name: string; rating: number; text: string | null; review_time: string | null }) => <ReviewItem key={review.id} name={review.reviewer_name} rating={review.rating} text={review.text} date={review.review_time} source="Google" />)}</div>
            </Panel>
          )}

          <Panel title="Reviews submitted through KZN Plumbers">
            <p className="mb-4 text-xs text-slate-500">Separate from Google reviews. Only the latest review from each signed-in reviewer for this business contributes to the current list and rating; independent legacy guest reviews remain separate.</p>
            {firstPartySummary ? (
              <p className="mb-4 text-sm font-semibold text-slate-800">{firstPartySummary.rating !== null ? `${firstPartySummary.rating.toFixed(1)} / 5 · ${firstPartySummary.count} current KZN Plumbers reviews` : "No current KZN Plumbers reviews recorded."}</p>
            ) : <p role="alert" className="mb-4 text-sm text-red-700">KZN Plumbers reviews could not be loaded. No rating is inferred.</p>}
            {reviewHistoryCount > 0 && <p className="mb-4 text-xs text-slate-500">Earlier review records are preserved, but superseded reviews do not count again.</p>}

            <ReviewForm plumberId={plumber.id} />
            <div className="mt-5 divide-y divide-slate-100">{internalReviews.map((review: { id: string; reviewer_name: string; rating: number; comment: string | null; created_at: string }) => <ReviewItem key={review.id} name={review.reviewer_name} rating={review.rating} text={review.comment} date={review.created_at} source="KZN Plumbers" reviewId={review.id} />)}</div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <section id="book" className="panel lg:sticky lg:top-24">
            <div className="mb-4 hidden gap-2 lg:flex">
              {phoneLink && !waLink ? (
                <TrackedContactLink href={phoneLink} kind="call_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-primary flex-1"><Phone className="h-4 w-4" /> Call</TrackedContactLink>
              ) : waLink && phoneLink ? (
                <>
                  <TrackedContactLink href={waLink} kind="whatsapp_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-whatsapp flex-1" newWindow><MessageCircle className="h-4 w-4" /> WhatsApp</TrackedContactLink>
                  <TrackedContactLink href={phoneLink} kind="call_click" plumberId={plumber.id} area={plumber.area} service={primaryService} className="btn-secondary"><Phone className="h-4 w-4" /> Call</TrackedContactLink>
                </>
              ) : <span className="text-sm text-slate-500">Phone not recorded</span>}
            </div>
            <h2 className="font-display text-xl font-bold text-slate-950">Contact this business</h2>
            {waLink && plumber.whatsapp_number ? <>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Send a request and follow up directly by WhatsApp. A request is not a confirmed booking; confirm acceptance, timing and call-out charges.</p>
              <div className="mt-4"><BookingForm plumberId={plumber.id} plumberWhatsApp={plumber.whatsapp_number} plumberName={plumber.trading_name} /></div>
            </> : <p className="mt-2 text-sm text-slate-600">{phoneLink ? "Call the listed number to discuss your job and arrange a booking." : "A usable public phone number has not been recorded. Check the business links, or compare another directory record."}</p>}
            {safeUrl(plumber.google_calendar_url) && <a href={safeUrl(plumber.google_calendar_url)!} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full"><CalendarDays className="h-4 w-4" /> Check calendar</a>}
          </section>
          {googleReviewLink && <ReviewLinkPanel reviewUrl={googleReviewLink} plumberName={plumber.trading_name} />}
        </aside>
      </main>

      {relatedResult.status === "rejected" && <p role="alert" className="mx-auto max-w-7xl px-4 py-6 text-sm text-red-700 sm:px-6">Alternative directory records could not be loaded just now.</p>}

      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-white px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Compare alternatives</p><h2 className="mt-2 font-display text-3xl font-bold text-slate-950">More records in {plumber.area}</h2></div>{region && <Link href={`/plumbers/${region.slug}`} className="text-sm font-bold text-brand hover:underline">View the regional collection</Link>}</div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((item, index) => <PlumberCard key={item.id} plumber={item} sourcePage="related_profiles" rankPosition={index + 1} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2 className="font-display text-xl font-bold text-slate-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function CredentialRow({ name, value, checked }: { name: string; value: string; checked: boolean }) {
  return <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><FileCheck2 className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-emerald-600" : "text-slate-400"}`} /><div><div className="text-sm font-bold text-slate-950">{name}</div><div className="mt-0.5 text-xs text-slate-600">{value}</div><div className="mt-1 text-[11px] font-semibold text-slate-500">{checked ? "Independently checked for this credential" : "Recorded, not independently confirmed by this label"}</div></div></div>;
}

function ReviewItem({ name, rating, text, date, source, reviewId }: { name: string; rating: number; text: string | null; date: string | null; source: string; reviewId?:string }) {
  return <article className="py-4"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-950">{name}</strong><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{source}</span>{date && <time className="ml-auto text-xs text-slate-500" dateTime={date}>{new Date(date).toLocaleDateString("en-ZA")}</time>}</div><div className="mt-1 text-sm text-amber-500" aria-label={`${rating} out of 5 stars`}>{"★".repeat(Math.max(0, Math.min(5, rating)))}{"☆".repeat(Math.max(0, 5 - Math.min(5, rating)))}</div>{text && <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>}{reviewId&&<Link href={`/contact?review=${encodeURIComponent(reviewId)}`} className="mt-3 inline-block text-xs text-slate-500 underline">Report a concern about this review</Link>}</article>;
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
