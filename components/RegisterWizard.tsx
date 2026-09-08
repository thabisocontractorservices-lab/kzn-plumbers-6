"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { KZN_AREAS, SPECIALTIES, isValidSAPhone } from "@/lib/utils";

const DRAFT_KEY = "kzn_registration_draft_v1";

type FileWithPreview = {
  file: File;
  preview: string; // object URL for images, empty for docs
};

type Step1 = {
  full_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  password: string;
  confirm: string;
};

type Step2 = {
  trading_name: string;
  area: string;
  hourly_rate: number;
  specialties: string[];
  is_emergency: boolean;
  google_calendar_url: string;
  google_place_id: string;
  pirb_number: string;
};

export function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [uploadReport, setUploadReport] = useState<{ total: number; confirmed: number; uncertain: string[]; warnings: string[] } | null>(null);
  const authUserId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [account, setAccount] = useState<Step1>({
    full_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirm: "",
  });

  const [biz, setBiz] = useState<Step2>({
    trading_name: "",
    area: "Durban North",
    hourly_rate: 450,
    specialties: [],
    is_emergency: false,
    google_calendar_url: "",
    google_place_id: "",
    pirb_number: "",
  });

  useEffect(() => {
    let active = true;
    // Read auth once before allowing input; no late profile response may skip steps
    // or overwrite phone numbers the user has begun entering.
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user && !user.email_confirmed_at) {
        setConfirmationEmail(user.email || "your account email");
        return;
      }
      if (!user?.email) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!active) return;
      authUserId.current = user.id;
      setLoggedInEmail(user.email);
      setAccount((prev) => ({
        ...prev, email: user.email!,
        full_name: typeof profile?.full_name === "string" ? profile.full_name : String(user.user_metadata?.full_name || ""),
        phone: String(profile?.phone_number || profile?.phone || ""),
        whatsapp: String(profile?.whatsapp_number || ""),
      }));
      // This short-lived same-tab draft contains no passwords or file bytes. A different
      // signed-in email never restores it, and contact inputs remain editable.
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        const draft = raw ? JSON.parse(raw) : null;
        if (draft && draft.email === user.email.toLowerCase() && draft.expires > Date.now()) {
          if (draft.business && typeof draft.business.trading_name === "string" && KZN_AREAS.includes(draft.business.area)
            && Array.isArray(draft.business.specialties) && draft.business.specialties.every((item: string) => SPECIALTIES.includes(item as typeof SPECIALTIES[number]))) {
            setBiz((prev) => ({ ...prev, ...draft.business }));
          }
          setAccount((prev) => ({ ...prev,
            full_name: typeof draft.full_name === "string" ? draft.full_name : prev.full_name,
            phone: typeof draft.phone === "string" ? draft.phone : prev.phone,
            whatsapp: typeof draft.whatsapp === "string" ? draft.whatsapp : prev.whatsapp,
          }));
        } else if (draft) sessionStorage.removeItem(DRAFT_KEY);
      } catch { /* Storage may be blocked. Re-entering the form still works. */ }
    })().catch(() => { if (active) setError("Session could not be checked. Sign in again if you already have an account."); })
      .finally(() => { if (active) setAuthChecking(false); });
    return () => { active = false; };
  }, []);

  // File state for step 3
  const [pirbCert, setPirbCert] = useState<FileWithPreview[]>([]);
  const [otherCerts, setOtherCerts] = useState<FileWithPreview[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<FileWithPreview[]>([]);
  const [workPhotos, setWorkPhotos] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Validate the current step before allowing user to proceed.
  // Returns the human-readable error or null if valid.
  function validateStep(s: number): string | null {
    if (s === 1) {
      if (account.full_name.trim().length < 2 || account.full_name.trim().length > 120) return "Enter your full name (2–120 characters).";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) return "Please enter a valid email address.";
      if (!isValidSAPhone(account.phone) || !/^[+\d\s()-]+$/.test(account.phone) || account.phone.length > 30)
        return "Please enter a valid SA cellphone number (e.g. 082 123 4567 or +27 82 123 4567).";
      if (!isValidSAPhone(account.whatsapp) || !/^[+\d\s()-]+$/.test(account.whatsapp) || account.whatsapp.length > 30)
        return "Please enter a valid SA WhatsApp number (e.g. 082 123 4567 or +27 82 123 4567).";
      if (!loggedInEmail) {
        if (account.password.length < 8 || account.password.length > 128) return "Password must be 8–128 characters.";
        if (account.password !== account.confirm) return "Passwords do not match.";
      }
    }
    if (s === 2) {
      if (!biz.trading_name.trim()) return "Please enter a trading name.";
      if (!biz.area) return "Please select an area of operation.";
      if (!Number.isInteger(biz.hourly_rate) || biz.hourly_rate < 0 || biz.hourly_rate > 100000)
        return "Enter an hourly rate from R0 to R100,000 (R0 means contact for a quote).";
      if (biz.specialties.length === 0)
        return "Please select at least one specialty.";
    }
    return null;
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        expires: Date.now() + 60 * 60 * 1000, email: account.email.trim().toLowerCase(),
        full_name: account.full_name, phone: account.phone, whatsapp: account.whatsapp, business: biz,
      }));
    } catch { /* Do not block signup when browser storage is unavailable. */ }
  }

  async function next() {
    if (inFlight.current || authChecking) return;
    setError(null);
    const err = validateStep(step);
    if (err) { setError(err); return; }
    if (step !== 1 || loggedInEmail) { setStep(step + 1); return; }
    inFlight.current = true;
    setSubmitting(true);
    saveDraft();
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: account.email.trim().toLowerCase(), password: account.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/register")}`,
          data: { full_name: account.full_name.trim() },
        },
      });
      if (signupError) throw signupError;
      setAccount((prev) => ({ ...prev, password: "", confirm: "" }));
      if (data.session && data.user?.email_confirmed_at && data.user.email) {
        authUserId.current = data.user.id;
        setLoggedInEmail(data.user.email);
        setAccount((prev) => ({ ...prev, email: data.user!.email! }));
        setStep(2);
      } else setConfirmationEmail(account.email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account setup could not be completed. Please try signing in.");
    } finally { inFlight.current = false; setSubmitting(false); }
  }

  async function submitApplication() {
    if (inFlight.current || authChecking) return;
    setError(null);
    if (!loggedInEmail) { setStep(1); setError("Confirm your email and sign in before submitting a business."); return; }
    const accountError = validateStep(1);
    if (accountError) { setError(accountError); setStep(1); return; }
    const businessError = validateStep(2);
    if (businessError) { setError(businessError); setStep(2); return; }
    inFlight.current = true;
    setSubmitting(true);
    saveDraft();
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (userError || !user?.email_confirmed_at || !session || user.id !== authUserId.current || session.user.id !== user.id) {
        throw new Error("Your signed-in account changed or expired. Sign in again and return to registration; no application was submitted.");
      }
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ full_name: account.full_name.trim(), email: user.email, phone: account.phone, whatsapp: account.whatsapp, business: biz }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || typeof data.plumberId !== "string") throw new Error(data.error || "Registration could not be confirmed. Check your dashboard before retrying.");
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Optional local draft. */ }
      const allFiles: { file: File; type: string; certName?: string }[] = [];
      for (const file of pirbCert) allFiles.push({ file: file.file, type: "cert", certName: "PIRB Certificate" });
      for (const file of otherCerts) allFiles.push({ file: file.file, type: "cert", certName: file.file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") });
      for (const file of profilePhoto) allFiles.push({ file: file.file, type: "profile_photo" });
      for (const file of workPhotos) allFiles.push({ file: file.file, type: "photo" });
      const report = { total: allFiles.length, confirmed: 0, uncertain: [] as string[], warnings: [] as string[] };
      for (let index = 0; index < allFiles.length; index++) {
        const item = allFiles[index];
        setUploadProgress(`Uploading files (${index + 1}/${allFiles.length})…`);
        try {
          const { data: { session: uploadSession } } = await supabase.auth.getSession();
          if (!uploadSession || uploadSession.user.id !== user.id) throw new Error("Session changed");
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("type", item.type);
          formData.append("plumber_id", data.plumberId);
          if (item.certName) formData.append("cert_name", item.certName);
          const upload = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${uploadSession.access_token}` }, body: formData });
          const result = await upload.json().catch(() => ({}));
          if (!upload.ok || result.success !== true) throw new Error("Upload not confirmed");
          report.confirmed++;
          if (typeof result.warning === "string") report.warnings.push(`${item.file.name}: ${result.warning}`);
        } catch { report.uncertain.push(item.file.name); }
      }
      setUploadReport(report);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Check your dashboard before retrying registration.");
    } finally { setUploadProgress(null); inFlight.current = false; setSubmitting(false); }
  }

  const stepTitle = ["Account details", "Business info", "Credentials & photos", ""][step - 1];

  if (authChecking) return <p role="status" className="text-sm text-gray-600">Checking your session…</p>;
  if (confirmationEmail) return (
    <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-6">
      <h2 className="font-display text-xl font-bold">Confirm your email, then continue</h2>
      <p className="mt-3 text-sm leading-relaxed">Check <strong>{confirmationEmail}</strong> for a confirmation link. It returns to registration. If you already have an account, sign in instead.</p>
      <p className="mt-3 text-sm leading-relaxed">No business application or files have been submitted yet. A same-tab draft may restore your details for up to one hour; otherwise re-enter them. Passwords and files are not saved in that draft.</p>
      <a href="/login?next=%2Fregister" className="btn-primary mt-4">Sign in and continue registration</a>
    </div>
  );

  return (
    <>
      {/* Stepper */}
      <div className="flex items-center justify-between mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                step === s
                  ? "bg-brand text-white border-brand"
                  : step > s
                    ? "bg-teal text-white border-teal"
                    : "bg-gray-100 text-gray-500 border-gray-100"
              }`}
            >
              {step > s ? "✓" : s === 4 ? "✓" : s}
            </div>
            {s < 4 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${step > s ? "bg-teal" : "bg-gray-200"}`}
              />
            )}
          </div>
        ))}
      </div>

      {step < 4 && (
        <h3 className="text-base font-semibold mb-5">{stepTitle}</h3>
      )}

      {step === 1 && loggedInEmail && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="font-semibold text-green-800">Signed in as {loggedInEmail}</p>
          <p className="text-sm text-green-700 mt-1">Check your name and business contact numbers below before continuing. Your account role will not be changed.</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Field label="Full name">
            <input
              required
              value={account.full_name}
              onChange={(e) => setAccount({ ...account, full_name: e.target.value })}
              className="input"
              placeholder="e.g. Sipho Mthembu"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                required
                value={account.email}
                disabled={Boolean(loggedInEmail)}
                autoComplete="email"
                maxLength={200}
                onChange={(e) => setAccount({ ...account, email: e.target.value })}
                className="input"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Cellphone number">
              <input
                type="tel"
                required
                value={account.phone}
                onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                className="input"
                placeholder="082 123 4567"
              />
            </Field>
          </div>
          <Field label="Business WhatsApp number" hint="Enter your SA cellphone number (not a website). Customers will WhatsApp you for bookings.">
            <input
              type="tel"
              inputMode="tel"
              required
              value={account.whatsapp}
              onChange={(e) => setAccount({ ...account, whatsapp: e.target.value })}
              className="input"
              placeholder="082 123 4567"
            />
          </Field>
          {!loggedInEmail && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Password"><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} className="input" /></Field>
                <Field label="Confirm password"><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={account.confirm} onChange={(e) => setAccount({ ...account, confirm: e.target.value })} className="input" /></Field>
              </div>
              <p className="text-xs text-gray-600">Email confirmation comes before the business application. Already registered? <a href="/login?next=%2Fregister" className="font-semibold text-brand underline">Sign in to continue</a>.</p>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Field label="Trading name">
            <input
              required
              value={biz.trading_name}
              onChange={(e) => setBiz({ ...biz, trading_name: e.target.value })}
              className="input"
              placeholder="e.g. Sipho's Master Plumbing"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Area of operation">
              <select
                value={biz.area}
                onChange={(e) => setBiz({ ...biz, area: e.target.value })}
                className="input"
              >
                {KZN_AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Hourly rate (R)">
              <input
                type="number"
                value={biz.hourly_rate}
                onChange={(e) =>
                  setBiz({ ...biz, hourly_rate: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
          </div>

          <Field label="Specialties (select all that apply)">
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg cursor-pointer hover:border-brand hover:bg-brand-light text-sm"
                >
                  <input
                    type="checkbox"
                    checked={biz.specialties.includes(s)}
                    onChange={(e) =>
                      setBiz({
                        ...biz,
                        specialties: e.target.checked
                          ? [...biz.specialties, s]
                          : biz.specialties.filter((x) => x !== s),
                      })
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 px-3 py-3 bg-emergency-light border border-emergency rounded-lg cursor-pointer text-emergency text-sm font-semibold">
            <input
              type="checkbox"
              checked={biz.is_emergency}
              onChange={(e) => setBiz({ ...biz, is_emergency: e.target.checked })}
            />
            🚨 I offer 24/7 emergency callouts
          </label>

          <Field
            label="Google Calendar booking URL"
            hint="Get this from Google Calendar > Appointment schedules."
            optional
          >
            <input
              value={biz.google_calendar_url}
              onChange={(e) =>
                setBiz({ ...biz, google_calendar_url: e.target.value })
              }
              className="input"
              placeholder="https://calendar.google.com/calendar/appointments/..."
            />
          </Field>

          <Field
            label="Google My Business Place ID"
            optional
            hint={
              <>
                Find your Place ID at{" "}
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline"
                >
                  developers.google.com/maps/documentation/places/web-service/place-id
                </a>
              </>
            }
          >
            <input
              value={biz.google_place_id}
              onChange={(e) => setBiz({ ...biz, google_place_id: e.target.value })}
              className="input"
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            />
          </Field>

          <Field label="PIRB registration number" optional>
            <input
              value={biz.pirb_number}
              onChange={(e) => setBiz({ ...biz, pirb_number: e.target.value })}
              className="input"
              placeholder="e.g. PB-12847"
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload your credentials and work photos. These help build trust with customers and speed up verification.
          </p>
          <p className="text-xs text-gray-500">
            You can also upload files later from your dashboard.
          </p>
          <FileDrop
            label="PIRB certificate (PDF or image)"
            icon="📜"
            accept="image/jpeg,image/png,image/webp,.pdf"
            files={pirbCert}
            onFilesChange={setPirbCert}
            maxFiles={1}
          />
          <FileDrop
            label="Additional certifications"
            icon="📂"
            accept="image/jpeg,image/png,image/webp,.pdf"
            files={otherCerts}
            onFilesChange={setOtherCerts}
            multiple
            maxFiles={5}
            help="SESSA, LPGSA, etc."
          />
          <FileDrop
            label="Profile photo"
            icon="👤"
            accept="image/jpeg,image/png,image/webp"
            files={profilePhoto}
            onFilesChange={setProfilePhoto}
            maxFiles={1}
          />
          <FileDrop
            label="Work photos"
            icon="📸"
            accept="image/jpeg,image/png,image/webp"
            files={workPhotos}
            onFilesChange={setWorkPhotos}
            multiple
            maxFiles={10}
            help="Up to 10 images of completed jobs"
          />
        </div>
      )}

      {step === 4 && loggedInEmail && (
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-4xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="font-display text-2xl mb-2">Application submitted!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Your business profile for <strong>{biz.trading_name}</strong> has been submitted.
            Our team will review your application and verify your credentials.
          </p>

          {uploadReport && (
            <div role="status" className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
              <p><strong>Files confirmed attached: {uploadReport.confirmed} of {uploadReport.total}.</strong></p>
              {uploadReport.total === 0 && <p className="mt-2">No files were selected. You can add credentials and photos from your dashboard.</p>}
              {uploadReport.uncertain.length > 0 && <><p className="mt-2">These uploads were not confirmed: {uploadReport.uncertain.join(", ")}.</p><p className="mt-2">The application is saved. Check your uploads before retrying any files; a lost response does not prove a file was not stored.</p></>}
              {uploadReport.warnings.map((warning, index) => <p className="mt-2" key={index}>{warning}</p>)}
              <a href="/dashboard/uploads" className="mt-3 inline-block font-semibold text-brand underline">Check or finish uploads</a>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 max-w-md mx-auto mb-6 text-left">
            <div className="flex gap-3 items-center mb-1">
              <span className="text-2xl">⏳</span>
              <strong className="text-amber-900">Under review</strong>
            </div>
            <p className="text-sm text-amber-800">
              We&apos;ll review the business details and any supplied evidence before the profile goes live. The profile remains offline until approved; check your dashboard for its status.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push("/dashboard")} className="btn-primary">
              Go to dashboard →
            </button>
            <button onClick={() => router.push("/")} className="btn-secondary">
              Back to directory
            </button>
          </div>
        </div>
      )}


      {step < 4 && (
        <>
          {error && (
            <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <strong className="block mb-0.5">Couldn&apos;t continue</strong>
              {error}
              {(error.includes("already exists") || error.includes("already registered")) && (
                <a href="/login" className="block mt-2 text-brand font-semibold underline">
                  Go to login →
                </a>
              )}
            </div>
          )}
          <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
              disabled={submitting}
              className={`btn-secondary ${step === 1 ? "invisible" : ""}`}
            >
              ← Back
            </button>
            <button
              onClick={() => (step === 3 ? submitApplication() : next())}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting
                ? uploadProgress || "Submitting..."
                : step === 3
                  ? "Submit application →"
                  : "Continue →"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Field({
  label,
  children,
  hint,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 mb-1 block">
        {label}{" "}
        {optional && (
          <span className="text-gray-400 font-normal">(optional)</span>
        )}
      </label>
      {children}
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function FileDrop({
  label,
  icon,
  accept,
  multiple,
  maxFiles = 10,
  help,
  files,
  onFilesChange,
}: {
  label: string;
  icon: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  help?: string;
  files: FileWithPreview[];
  onFilesChange: (files: FileWithPreview[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleSelect(selected: FileList | null) {
    if (!selected) return;
    const candidates = Array.from(selected);
    const supported = ["image/jpeg", "image/png", "image/webp", ...(accept?.includes(".pdf") ? ["application/pdf"] : [])];
    const rejected = candidates.filter((file) => file.size <= 0 || file.size > 10 * 1024 * 1024 || !supported.includes(file.type));
    const available = multiple ? maxFiles - files.length : 1;
    setFileError(rejected.length ? `Not selected: ${rejected.map((file) => file.name).join(", ")}. Use supported files smaller than 10 MB.`
      : candidates.length > available ? `Only ${available} more file(s) can be selected here.` : null);
    const newFiles: FileWithPreview[] = candidates
      .filter((file) => !rejected.includes(file))
      .slice(0, available)
      .map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "" }));
    if (!newFiles.length) { if (inputRef.current) inputRef.current.value = ""; return; }

    if (multiple) {
      onFilesChange([...files, ...newFiles].slice(0, maxFiles));
    } else {
      // Revoke old preview
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      onFilesChange(newFiles.slice(0, 1));
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    const removed = files[index];
    if (removed.preview) URL.revokeObjectURL(removed.preview);
    onFilesChange(files.filter((_, i) => i !== index));
  }

  const canAdd = files.length < maxFiles;

  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      {fileError && <p role="alert" className="mb-2 text-xs text-red-700">{fileError}</p>}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative group flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            >
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <span className="text-lg">📄</span>
              )}
              <span className="text-xs text-gray-700 max-w-[120px] truncate">
                {f.file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-1 text-red-400 hover:text-red-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAdd && (
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand hover:bg-brand-light transition-colors">
          <div className="text-3xl text-gray-400 mb-2">{icon}</div>
          <div className="text-sm text-gray-600">
            <strong className="text-brand">Click to upload</strong> or drag
            &amp; drop
          </div>
          {help && <div className="text-xs text-gray-500 mt-1">{help}</div>}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => handleSelect(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}
