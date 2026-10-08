"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, Loader2, Lock, MapPin, Siren, Star, X } from "lucide-react";
import { readAttribution } from "@/components/AttributionCapture";
import {
  CONSENT_TEXT,
  LEAD_AREAS,
  LEAD_SERVICES,
  LEAD_URGENCIES,
  MAX_PLUMBERS_PER_LEAD,
  getLeadArea,
  getLeadService,
} from "@/lib/leads";
import { isValidSAPhone } from "@/lib/utils";

type PlumberCard = {
  id: string; trading_name: string; slug: string | null; area: string; photo_url: string | null;
  rating: number | null; review_count: number; verified: boolean; emergency: boolean; services: string[];
};

const STEPS = ["Your job", "Urgency", "Plumbers", "Your details"] as const;
const MAX_PHOTOS = 4;

/** Shrinks phone photos (often 4–8 MB) to ~300 KB so the request uploads fast on mobile data. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function EstimateForm() {
  const router = useRouter();
  const search = useSearchParams();
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const topRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [areaKey, setAreaKey] = useState(() => (getLeadArea(search.get("area")) && search.get("area") !== "durban" ? search.get("area")! : ""));
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [serviceKey, setServiceKey] = useState(() => getLeadService(search.get("service"))?.key ?? "");
  const [urgency, setUrgency] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);

  const requestedId = search.get("plumber");
  const [requested, setRequested] = useState<PlumberCard | null>(null);
  const [requestedChecked, setRequestedChecked] = useState(!requestedId);
  const [fallbackAllowed, setFallbackAllowed] = useState(true);

  const [plumbers, setPlumbers] = useState<PlumberCard[] | null>(null);
  const [plumbersLoading, setPlumbersLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [kznChoose, setKznChoose] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [sameWhatsApp, setSameWhatsApp] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Profile "Request a Quote" → load that plumber.
  useEffect(() => {
    if (!requestedId) return;
    fetch(`/api/leads/plumbers?id=${encodeURIComponent(requestedId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        setRequested(body.plumber ?? null);
        if (body.plumber?.area && !areaKey) {
          const match = LEAD_AREAS.find((a) => (a.dbAreas as readonly string[]).includes(body.plumber.area));
          if (match) setAreaKey(match.key);
        }
      })
      .catch(() => setRequested(null))
      .finally(() => setRequestedChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the requested plumber
  }, [requestedId]);

  // Load plumbers when reaching the plumber step.
  useEffect(() => {
    if (step !== 2 || requested || !areaKey || !serviceKey) return;
    let cancelled = false;
    setPlumbersLoading(true);
    const q = new URLSearchParams({ area: areaKey, service: serviceKey, urgency: urgency || "planning", suburb });
    fetch(`/api/leads/plumbers?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const list: PlumberCard[] = body.plumbers ?? [];
        setPlumbers(list);
        if (!list.length) setKznChoose(true);
      })
      .catch(() => { if (!cancelled) { setPlumbers([]); setKznChoose(true); } })
      .finally(() => { if (!cancelled) setPlumbersLoading(false); });
    return () => { cancelled = true; };
  }, [step, requested, areaKey, serviceKey, urgency, suburb]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const area = getLeadArea(areaKey);
  const service = getLeadService(serviceKey);

  function go(next: number) {
    setError(null);
    setFieldErrors({});
    setStep(next);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!areaKey) e.area = "Choose your area.";
      if (suburb.trim().length < 2) e.suburb = "Enter your suburb.";
      if (!serviceKey) e.service = "Choose the job you need done.";
    }
    if (s === 1 && !urgency) e.urgency = "Choose how soon you need a plumber.";
    if (s === 2 && !requested && !kznChoose && selected.length === 0) e.plumbers = "Choose at least one plumber, or let KZNPlumbers choose for you.";
    if (s === 3) {
      if (firstName.trim().length < 2) e.firstName = "Enter your first name.";
      if (!isValidSAPhone(phone)) e.phone = "Enter a valid SA cellphone number, e.g. 082 123 4567.";
      if (!sameWhatsApp && whatsapp && !isValidSAPhone(whatsapp)) e.whatsapp = "Check the WhatsApp number.";
      if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Check your email address.";
      if (!consent) e.consent = "Please tick the box so we can share your request with plumbers.";
    }
    setFieldErrors(e);
    if (Object.keys(e).length) { setError(Object.values(e)[0]); return false; }
    return true;
  }

  function next() { if (validateStep(step)) go(step + 1); }

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, room);
    const shrunk = await Promise.all(files.map(shrinkImage));
    setPhotos((cur) => [...cur, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function togglePlumber(id: string) {
    setKznChoose(false);
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_PLUMBERS_PER_LEAD ? cur : [...cur, id]);
  }

  async function submit() {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setError(null);
    const data = {
      area_key: areaKey, suburb: suburb.trim(), postcode: postcode.trim(), service_key: serviceKey, urgency,
      description: description.trim(),
      plumber_ids: requested ? [] : kznChoose ? [] : selected,
      preferred_plumber_id: requested?.id ?? null, fallback_allowed: fallbackAllowed,
      first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(),
      whatsapp: sameWhatsApp ? "" : whatsapp.trim(), email: email.trim(),
      consent_share: consent, consent_marketing: marketing,
      attribution: readAttribution(), website, started_at: startedAt.current,
    };
    const body = new FormData();
    body.set("data", JSON.stringify(data));
    photos.forEach((p) => body.append("photos", p.file));
    try {
      const res = await fetch("/api/leads", { method: "POST", body });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Your request could not be sent. Please try again.");
      router.push(`/get-estimate/received?ref=${encodeURIComponent(result.ref)}&t=${encodeURIComponent(result.token)}${result.duplicate ? "&dup=1" : ""}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const tile = (active: boolean) =>
    `relative flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition ${active ? "border-brand bg-brand-light text-brand-dark" : "border-gray-200 bg-white text-gray-800 hover:border-brand/40"}`;
  const label = "block text-sm font-semibold text-gray-800 mb-1.5";
  const fieldErr = (k: string) => fieldErrors[k] ? <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors[k]}</p> : null;

  const plumberStep = useMemo(() => {
    if (requestedId && !requestedChecked) return <div className="py-10 text-center text-gray-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
    if (requested) {
      return (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your request goes to</h2>
          <p className="mt-1 text-sm text-gray-500">They&apos;ll get your job first. Nobody else sees it unless you agree below.</p>
          <div className="mt-4"><PlumberTile p={requested} selected onToggle={() => {}} locked /></div>
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={fallbackAllowed} onChange={(e) => setFallbackAllowed(e.target.checked)} />
            <span>If {requested.trading_name} can&apos;t help, KZNPlumbers may find me another suitable plumber.</span>
          </label>
        </div>
      );
    }
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900">Choose up to {MAX_PLUMBERS_PER_LEAD} plumbers</h2>
        <p className="mt-1 text-sm text-gray-500">
          Claimed businesses in {area?.label ?? "your area"} for {service?.label.toLowerCase() ?? "this job"}, best reviewed first. Only the plumbers you pick will see your request.
        </p>
        {requestedId && requestedChecked && (
          <p className="mt-3 rounded-lg bg-amber-light px-3 py-2 text-sm text-amber">That plumber isn&apos;t taking requests through KZNPlumbers right now — choose from these instead.</p>
        )}
        {plumbersLoading ? (
          <div className="py-10 text-center text-gray-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /><p className="mt-2 text-sm">Finding plumbers near {suburb || "you"}…</p></div>
        ) : (
          <>
            {plumbers && plumbers.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {plumbers.map((p) => <PlumberTile key={p.id} p={p} selected={selected.includes(p.id)} disabled={!selected.includes(p.id) && selected.length >= MAX_PLUMBERS_PER_LEAD} onToggle={() => togglePlumber(p.id)} />)}
              </div>
            ) : plumbers ? (
              <p className="mt-4 rounded-xl bg-brand-light p-4 text-sm text-brand-dark">We don&apos;t have a claimed plumber listed for this area and job yet — KZNPlumbers will find one for you personally.</p>
            ) : null}
            <p className="mt-3 text-xs text-gray-500">{selected.length} of {MAX_PLUMBERS_PER_LEAD} chosen</p>
            <label className={`mt-3 ${tile(kznChoose)} cursor-pointer`}>
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={kznChoose} onChange={(e) => { setKznChoose(e.target.checked); if (e.target.checked) setSelected([]); }} />
              <span>Let KZNPlumbers choose the best plumber for me</span>
            </label>
          </>
        )}
        {fieldErr("plumbers")}
      </div>
    );
  }, [requested, requestedId, requestedChecked, fallbackAllowed, plumbers, plumbersLoading, selected, kznChoose, area, service, suburb, fieldErrors]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={topRef} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-100 px-5 pt-5 sm:px-7">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
          <span>Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
          <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Free · no obligation</span>
        </div>
        <div className="mt-2 mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Where do you need a plumber?</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
                <div>
                  <label htmlFor="area" className={label}>Area</label>
                  <select id="area" className={`input ${fieldErrors.area ? "border-red-400" : ""}`} value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
                    <option value="">Choose your area…</option>
                    {LEAD_AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                  {fieldErr("area")}
                </div>
                <div>
                  <label htmlFor="suburb" className={label}>Suburb</label>
                  <input id="suburb" className={`input ${fieldErrors.suburb ? "border-red-400" : ""}`} value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Westville" autoComplete="address-level3" />
                  {fieldErr("suburb")}
                </div>
                <div>
                  <label htmlFor="postcode" className={label}>Postcode <span className="font-normal text-gray-400">(opt.)</span></label>
                  <input id="postcode" inputMode="numeric" className="input" value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="3629" autoComplete="postal-code" />
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">What plumbing job would you like an estimate for?</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LEAD_SERVICES.map((s) => (
                  <button key={s.key} type="button" onClick={() => setServiceKey(s.key)} className={tile(serviceKey === s.key)} aria-pressed={serviceKey === s.key}>
                    <span className="text-lg" aria-hidden>{s.emoji}</span>{s.label}
                    {serviceKey === s.key && <Check className="absolute right-2 top-2 h-4 w-4 text-brand" />}
                  </button>
                ))}
              </div>
              {fieldErr("service")}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">How soon do you need a plumber?</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {LEAD_URGENCIES.map((u) => (
                  <button key={u.key} type="button" onClick={() => setUrgency(u.key)} className={tile(urgency === u.key)} aria-pressed={urgency === u.key}>
                    {u.key === "emergency" ? <Siren className="h-5 w-5 text-emergency" /> : <span className={`h-4 w-4 rounded-full border-2 ${urgency === u.key ? "border-brand bg-brand" : "border-gray-300"}`} />}
                    <span><span className="block">{u.label}</span><span className="block text-xs font-normal text-gray-500">{u.hint}</span></span>
                  </button>
                ))}
              </div>
              {fieldErr("urgency")}
            </div>
            <div>
              <label htmlFor="desc" className="block text-xl font-bold text-gray-900">Describe the problem <span className="text-sm font-normal text-gray-400">(optional, but helps)</span></label>
              <textarea id="desc" rows={4} maxLength={1500} className="input mt-3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Kitchen sink is blocked and water is backing up into the bath." />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Photos <span className="font-normal text-gray-400">(optional — up to {MAX_PHOTOS})</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                    <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotos((cur) => cur.filter((x) => x.url !== p.url))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label={`Remove photo ${i + 1}`}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-brand hover:text-brand">
                    <Camera className="h-5 w-5" /> Add
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && plumberStep}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Where should we send your estimate?</h2>
              <p className="mt-1 text-sm text-gray-500">Your number is only shared with the plumber{requested || selected.length === 1 ? "" : "s"} who accept{requested || selected.length === 1 ? "s" : ""} your job.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fn" className={label}>First name *</label>
                <input id="fn" className={`input ${fieldErrors.firstName ? "border-red-400" : ""}`} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                {fieldErr("firstName")}
              </div>
              <div>
                <label htmlFor="ln" className={label}>Surname <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="ln" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
              <div>
                <label htmlFor="ph" className={label}>Mobile number *</label>
                <input id="ph" type="tel" inputMode="tel" className={`input ${fieldErrors.phone ? "border-red-400" : ""}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 123 4567" autoComplete="tel" />
                {fieldErr("phone")}
              </div>
              <div>
                <label htmlFor="em" className={label}>Email <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="em" type="email" inputMode="email" className={`input ${fieldErrors.email ? "border-red-400" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                {fieldErr("email")}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={sameWhatsApp} onChange={(e) => setSameWhatsApp(e.target.checked)} />
              This number is also on WhatsApp
            </label>
            {!sameWhatsApp && (
              <div>
                <label htmlFor="wa" className={label}>WhatsApp number <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="wa" type="tel" inputMode="tel" className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="072 000 0000" />
                {fieldErr("whatsapp")}
              </div>
            )}
            <div className="hidden" aria-hidden>
              <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>
            <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${fieldErrors.consent ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-gray-700">{CONSENT_TEXT.replace(" See the Privacy Policy.", "")} <Link href="/privacy#quote-requests" target="_blank" className="font-semibold text-brand underline">Privacy Policy</Link>. *</span>
            </label>
            <label className="flex items-start gap-3 px-1 text-sm text-gray-600">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>Send me occasional plumbing tips and offers (optional — unsubscribe anytime).</span>
            </label>
          </div>
        )}

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      </div>

      <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4 sm:px-7">
        {step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} className="btn-secondary" disabled={submitting}><ArrowLeft className="h-4 w-4" /> Back</button>
        ) : <span className="hidden text-xs text-gray-500 sm:block"><MapPin className="mr-1 inline h-3.5 w-3.5" />KwaZulu-Natal only</span>}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn ml-auto bg-green-600 px-6 py-3 text-base text-white hover:bg-green-700">Continue <ArrowRight className="h-4 w-4" /></button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting} className="btn ml-auto bg-green-600 px-6 py-3 text-base text-white hover:bg-green-700 disabled:opacity-60">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Get My Free Estimate <ArrowRight className="h-4 w-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

function PlumberTile({ p, selected, disabled, locked, onToggle }: { p: PlumberCard; selected: boolean; disabled?: boolean; locked?: boolean; onToggle: () => void }) {
  const initials = p.trading_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <div className={`relative rounded-xl border-2 transition ${selected ? "border-brand bg-brand-light" : "border-gray-200 bg-white hover:border-brand/40"} ${disabled ? "opacity-50" : ""}`}>
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || locked}
      aria-pressed={selected}
      aria-label={`${selected ? "Remove" : "Choose"} ${p.trading_name}`}
      className={`flex w-full items-start gap-3 p-3 text-left ${p.slug && !locked ? "pb-7" : ""} ${locked ? "cursor-default" : ""}`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand text-white">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase public photo
          <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
        ) : <span className="flex h-full items-center justify-center font-bold">{initials}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-bold leading-snug text-gray-900">{p.trading_name}</p>
        <p className="text-xs text-gray-500">{p.area}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {p.rating ? <span className="inline-flex items-center gap-0.5 font-semibold text-gray-800"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.rating.toFixed(1)} <span className="font-normal text-gray-500">({p.review_count})</span></span> : <span className="text-gray-400">New on KZNPlumbers</span>}
          {p.verified && <span className="inline-flex items-center gap-0.5 font-semibold text-teal"><BadgeCheck className="h-3.5 w-3.5" />Verified</span>}
          {p.emergency && <span className="font-semibold text-emergency">24/7</span>}
        </div>
      </div>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-brand bg-brand text-white" : "border-gray-300 bg-white"}`}>{selected && <Check className="h-4 w-4" />}</span>
    </button>
    {p.slug && !locked && <Link href={`/plumber/${p.slug}`} target="_blank" className="absolute bottom-2 left-[5.25rem] text-xs font-semibold text-brand hover:underline">View profile</Link>}
    </div>
  );
}
