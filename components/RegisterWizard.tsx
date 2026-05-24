"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { KZN_AREAS, SPECIALTIES, formatWhatsApp, isValidSAPhone } from "@/lib/utils";

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
  const [account, setAccount] = useState<Step1>({
    full_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirm: "",
  });

  // If user is already logged in, skip to step 2 (business details)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoggedInEmail(session.user.email ?? null);
        setAccount((prev) => ({
          ...prev,
          email: session.user.email ?? "",
          full_name: session.user.user_metadata?.full_name ?? "",
        }));
        setStep(2);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // File state for step 3
  const [pirbCert, setPirbCert] = useState<FileWithPreview[]>([]);
  const [otherCerts, setOtherCerts] = useState<FileWithPreview[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<FileWithPreview[]>([]);
  const [workPhotos, setWorkPhotos] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Validate the current step before allowing user to proceed.
  // Returns the human-readable error or null if valid.
  function validateStep(s: number): string | null {
    if (s === 1 && !loggedInEmail) {
      // Only validate account fields if user is NOT already logged in
      if (!account.full_name.trim()) return "Please enter your full name.";
      if (!account.email.trim()) return "Please enter your email.";
      if (!account.phone.trim()) return "Please enter your cellphone number.";
      if (!isValidSAPhone(account.phone))
        return "Please enter a valid SA cellphone number (e.g. 082 123 4567 or +27 82 123 4567).";
      if (!account.whatsapp.trim()) return "Please enter your business WhatsApp number.";
      if (!isValidSAPhone(account.whatsapp))
        return "Please enter a valid SA WhatsApp number (e.g. 082 123 4567 or +27 82 123 4567).";
      if (account.password.length < 6)
        return "Password must be at least 6 characters.";
      if (account.password !== account.confirm)
        return "Passwords do not match.";
    }
    if (s === 2) {
      if (!biz.trading_name.trim()) return "Please enter a trading name.";
      if (!biz.area) return "Please select an area of operation.";
      if (!biz.hourly_rate || biz.hourly_rate < 1)
        return "Please enter a valid hourly rate.";
      if (biz.specialties.length === 0)
        return "Please select at least one specialty.";
    }
    return null;
  }

  function next() {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setStep(step + 1);
  }

  async function submitApplication() {
    setError(null);

    // Re-validate everything before the network call.
    if (!loggedInEmail) {
      const step1Err = validateStep(1);
      if (step1Err) {
        setError(step1Err);
        setStep(1);
        return;
      }
    }
    const step2Err = validateStep(2);
    if (step2Err) {
      setError(step2Err);
      setStep(2);
      return;
    }

    setSubmitting(true);

    try {
      // ── Check if user is already logged in ──────────────────────────────
      // If they're already authenticated (e.g. logged-in plumber adding a
      // listing, or admin testing), skip signUp and use their existing session.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      const alreadyLoggedIn = !!existingSession?.user;

      let userEmail = account.email;

      if (!alreadyLoggedIn) {
        // ── Step 1: Client-side signUp() ─────────────────────────────────
        // This creates the auth user AND sends the confirmation email.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: account.email,
          password: account.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
            data: {
              full_name: account.full_name,
              role: "plumber",
            },
          },
        });

        if (signUpError) {
          const msg = signUpError.message.toLowerCase();

          // Rate-limited by Supabase
          if (msg.includes("security purposes") || msg.includes("rate limit") || msg.includes("request this after")) {
            const seconds = msg.match(/after (\d+) second/)?.[1] ?? "60";
            setError(
              `Too many attempts. Please wait ${seconds} seconds and try again. ` +
              `If you already registered, check your email for a confirmation link and then log in instead.`
            );
            setSubmitting(false);
            return;
          }

          // User already exists
          if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already exists")) {
            setError(
              "An account with this email already exists. Check your inbox for a confirmation email, " +
              "then go to the login page to sign in."
            );
            setSubmitting(false);
            return;
          }

          setError(signUpError.message);
          setSubmitting(false);
          return;
        }

        // Supabase may return a "fake" user with identities=[] if email
        // already exists (to prevent email enumeration). Detect this.
        if (!signUpData.user) {
          setError(
            "Could not create account. If you already registered with this email, " +
            "check your inbox for a confirmation email, then go to the login page."
          );
          setSubmitting(false);
          return;
        }

        if (signUpData.user.identities?.length === 0) {
          setError(
            "An account with this email already exists. Check your inbox for a confirmation email, " +
            "then go to the login page to sign in."
          );
          setSubmitting(false);
          return;
        }
      } else {
        // Already logged in — use their email
        userEmail = existingSession.user.email ?? account.email;
      }

      // ── Step 2: Server route inserts plumber row ─────────────────────────
      // Uses service-role to bypass RLS (user may have no session yet).
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          phone: account.phone,
          whatsapp: account.whatsapp,
          business: {
            trading_name: biz.trading_name,
            area: biz.area,
            hourly_rate: biz.hourly_rate,
            specialties: biz.specialties,
            is_emergency: biz.is_emergency,
            google_calendar_url: biz.google_calendar_url,
            google_place_id: biz.google_place_id,
            pirb_number: biz.pirb_number,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // ── Step 3: Upload files (fire-and-forget — don't block success) ────
      const allFiles: { file: File; type: string; certName?: string }[] = [];

      for (const f of pirbCert) {
        allFiles.push({ file: f.file, type: "cert", certName: "PIRB Certificate" });
      }
      for (const f of otherCerts) {
        allFiles.push({
          file: f.file,
          type: "cert",
          certName: f.file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        });
      }
      for (const f of profilePhoto) {
        allFiles.push({ file: f.file, type: "profile_photo" });
      }
      for (const f of workPhotos) {
        allFiles.push({ file: f.file, type: "photo" });
      }

      if (allFiles.length > 0) {
        setUploadProgress(`Uploading files (0/${allFiles.length})...`);

        for (let i = 0; i < allFiles.length; i++) {
          setUploadProgress(`Uploading files (${i + 1}/${allFiles.length})...`);
          const fd = new FormData();
          fd.append("file", allFiles[i].file);
          fd.append("type", allFiles[i].type);
          fd.append("email", userEmail);
          if (allFiles[i].certName) fd.append("cert_name", allFiles[i].certName!);

          try {
            await fetch("/api/upload", { method: "POST", body: fd });
          } catch {
            // Silently continue — files can be re-uploaded from dashboard
          }
        }

        setUploadProgress(null);
      }

      // Success — show appropriate screen
      setSubmitting(false);
      setStep(4);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const stepTitle = ["Account details", "Business info", "Credentials & photos", ""][step - 1];

  return (
    <>
      {/* Stepper */}
      <div className="flex items-center justify-between mb-10">
        {[1, 2, 3, 4].map((s, i) => (
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
          <p className="text-sm text-green-700 mt-1">Click Continue to set up your business profile.</p>
        </div>
      )}

      {step === 1 && !loggedInEmail && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Password">
              <input
                type="password"
                required
                value={account.password}
                onChange={(e) => setAccount({ ...account, password: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                required
                value={account.confirm}
                onChange={(e) => setAccount({ ...account, confirm: e.target.value })}
                className="input"
              />
            </Field>
          </div>
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
            accept="image/*,.pdf"
            files={pirbCert}
            onFilesChange={setPirbCert}
            maxFiles={1}
          />
          <FileDrop
            label="Additional certifications"
            icon="📂"
            accept="image/*,.pdf"
            files={otherCerts}
            onFilesChange={setOtherCerts}
            multiple
            maxFiles={5}
            help="SESSA, LPGSA, etc."
          />
          <FileDrop
            label="Profile photo"
            icon="👤"
            accept="image/*"
            files={profilePhoto}
            onFilesChange={setProfilePhoto}
            maxFiles={1}
          />
          <FileDrop
            label="Work photos"
            icon="📸"
            accept="image/*"
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

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 max-w-md mx-auto mb-6 text-left">
            <div className="flex gap-3 items-center mb-1">
              <span className="text-2xl">⏳</span>
              <strong className="text-amber-900">Under review</strong>
            </div>
            <p className="text-sm text-amber-800">
              Applications are typically reviewed within <strong>24–48 hours</strong>.
              You&apos;ll receive an email once your profile is approved and live on the directory.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { window.location.href = "/dashboard"; }} className="btn-primary">
              Go to dashboard →
            </button>
            <button onClick={() => { window.location.href = "/"; }} className="btn-secondary">
              Back to directory
            </button>
          </div>
        </div>
      )}

      {step === 4 && !loggedInEmail && (
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-brand-light text-brand flex items-center justify-center text-4xl mx-auto mb-6">
            ✉️
          </div>
          <h2 className="font-display text-2xl mb-2">Check your email!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            We&apos;ve sent a confirmation link to <strong>{account.email}</strong>. Click the link in the email to activate your account.
          </p>

          <div className="bg-brand-light rounded-xl p-5 max-w-md mx-auto mb-6 text-left">
            <div className="flex gap-3 items-center mb-1">
              <span className="text-2xl">📋</span>
              <strong>What happens next</strong>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div>1. 📧 <strong>Confirm your email</strong> — click the link we just sent</div>
              <div>2. 🔑 <strong>Log in</strong> — use your email &amp; password</div>
              <div>3. ⏳ <strong>Admin review</strong> — we verify your credentials (24–48 hrs)</div>
              <div>4. 🚀 <strong>Go live</strong> — your profile appears on the directory</div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Didn&apos;t get the email? Check your spam folder or try registering again.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { window.location.href = "/login"; }} className="btn-primary">
              Go to login →
            </button>
            <button onClick={() => { window.location.href = "/"; }} className="btn-secondary">
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

  function handleSelect(selected: FileList | null) {
    if (!selected) return;

    const newFiles: FileWithPreview[] = Array.from(selected)
      .slice(0, maxFiles - files.length)
      .filter((f) => f.size <= 10 * 1024 * 1024) // 10MB limit
      .map((f) => ({
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      }));

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
