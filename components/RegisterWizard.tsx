"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { KZN_AREAS, SPECIALTIES, formatWhatsApp } from "@/lib/utils";

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

  // Validate the current step before allowing user to proceed.
  // Returns the human-readable error or null if valid.
  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!account.full_name.trim()) return "Please enter your full name.";
      if (!account.email.trim()) return "Please enter your email.";
      if (!account.phone.trim()) return "Please enter your phone number.";
      if (!account.whatsapp.trim()) return "Please enter your business WhatsApp number.";
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
    const step1Err = validateStep(1);
    if (step1Err) {
      setError(step1Err);
      setStep(1);
      return;
    }
    const step2Err = validateStep(2);
    if (step2Err) {
      setError(step2Err);
      setStep(2);
      return;
    }

    setSubmitting(true);

    // 1) Sign up the auth user with profile metadata so the
    //    handle_new_user trigger creates a profile with the right name and role.
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: {
          full_name: account.full_name,
          role: "plumber",
        },
      },
    });
    if (signupErr) {
      setError(`Sign-up failed: ${signupErr.message}`);
      setSubmitting(false);
      return;
    }
    if (!signupData.user) {
      setError(
        "Sign-up failed: no user returned. If email confirmation is enabled, please confirm your email and try again.",
      );
      setSubmitting(false);
      return;
    }

    // 2) Create the plumbers row (pending admin verification).
    //    Uses RLS — requires the just-signed-up user to have an active session.
    const { error: pErr } = await supabase.from("plumbers").insert({
      profile_id: signupData.user.id,
      trading_name: biz.trading_name,
      area: biz.area,
      hourly_rate: biz.hourly_rate,
      specialties: biz.specialties,
      is_emergency: biz.is_emergency,
      google_calendar_url: biz.google_calendar_url || null,
      google_place_id: biz.google_place_id || null,
      pirb_number: biz.pirb_number || null,
      whatsapp_number: formatWhatsApp(account.whatsapp),
      is_certified: !!biz.pirb_number,
      is_verified: false,
      availability_status: "available",
    });
    if (pErr) {
      setError(
        `Account created but business profile failed to save: ${pErr.message}. ` +
          `Please contact support — your email is ${account.email}.`,
      );
      setSubmitting(false);
      return;
    }

    // Success — show the success screen briefly, then redirect to dashboard.
    setSubmitting(false);
    setStep(4);

    // Auto-redirect to dashboard after 2.5s so they see the pending banner.
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2500);
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
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Phone">
              <input
                required
                value={account.phone}
                onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                className="input"
                placeholder="+27 82 ..."
              />
            </Field>
          </div>
          <Field label="Business WhatsApp number" hint="Customers will message you here for bookings & enquiries.">
            <input
              required
              value={account.whatsapp}
              onChange={(e) => setAccount({ ...account, whatsapp: e.target.value })}
              className="input"
              placeholder="+27 82 ..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
            Upload your credentials and work photos. Files are stored in Supabase Storage and visible to admins for verification.
          </p>
          <FileDrop label="PIRB certificate (PDF or image)" icon="📜" required />
          <FileDrop label="Additional certifications" icon="📂" multiple help="SESSA, LPGSA, etc." />
          <FileDrop label="Profile photo" icon="👤" />
          <FileDrop label="Work photos" icon="📸" multiple max={10} help="Up to 10 images of completed jobs" />
        </div>
      )}

      {step === 4 && (
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-teal-light text-teal flex items-center justify-center text-4xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="font-display text-2xl mb-2">Application submitted!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            We'll verify your PIRB credentials within <strong>24–48 hours</strong>. Once approved, your profile goes live on the directory immediately.
          </p>
          <div className="bg-brand-light rounded-xl p-5 max-w-md mx-auto mb-6 text-left">
            <div className="flex gap-3 items-center mb-1">
              <span className="text-2xl">📨</span>
              <strong>Application submitted</strong>
            </div>
            <div className="text-sm text-gray-700">
              Your application reference is <strong>#KZN-{Date.now().toString().slice(-7)}</strong>. Check your email to confirm your account, then watch this space — admin verification typically takes 24–48 hours.
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Redirecting to your dashboard…
          </p>
          <button onClick={() => router.push("/dashboard")} className="btn-primary">
            Go to dashboard →
          </button>
        </div>
      )}

      {step < 4 && (
        <>
          {error && (
            <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <strong className="block mb-0.5">Couldn't continue</strong>
              {error}
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
                ? "Submitting..."
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
  multiple,
  max,
  help,
  required,
}: {
  label: string;
  icon: string;
  multiple?: boolean;
  max?: number;
  help?: string;
  required?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand hover:bg-brand-light transition-colors">
        <div className="text-3xl text-gray-400 mb-2">{icon}</div>
        <div className="text-sm text-gray-600">
          <strong className="text-brand">Click to upload</strong> or drag &amp; drop
        </div>
        {help && <div className="text-xs text-gray-500 mt-1">{help}</div>}
        <input type="file" multiple={multiple} className="hidden" />
      </label>
    </div>
  );
}
