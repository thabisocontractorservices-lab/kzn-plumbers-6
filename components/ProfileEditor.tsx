"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { KZN_AREAS, SPECIALTIES } from "@/lib/utils";

export function ProfileEditor({
  plumber,
}: {
  plumber: {
    id: string;
    trading_name: string;
    area: string;
    hourly_rate: number;
    about: string | null;
    specialties: string[];
    is_emergency: boolean;
    google_calendar_url: string | null;
    google_place_id: string | null;
    pirb_number: string | null;
    whatsapp_number: string;
    website_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    tiktok_url: string | null;
    sessa_number: string | null;
    lpgsa_number: string | null;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(plumber);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("plumbers")
      .update({
        trading_name: form.trading_name,
        area: form.area,
        hourly_rate: form.hourly_rate,
        about: form.about,
        specialties: form.specialties,
        is_emergency: form.is_emergency,
        google_calendar_url: form.google_calendar_url || null,
        google_place_id: form.google_place_id || null,
        pirb_number: form.pirb_number || null,
        whatsapp_number: form.whatsapp_number,
        website_url: form.website_url || null,
        facebook_url: form.facebook_url || null,
        instagram_url: form.instagram_url || null,
        tiktok_url: form.tiktok_url || null,
        sessa_number: form.sessa_number || null,
        lpgsa_number: form.lpgsa_number || null,
      })
      .eq("id", plumber.id);
    setSaving(false);
    if (error) return alert(error.message);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.refresh();
    }, 1500);
  }

  return (
    <form onSubmit={save} className="panel space-y-4">
      <div>
        <label className="text-xs font-semibold mb-1 block">Trading name</label>
        <input
          required
          value={form.trading_name}
          onChange={(e) => setForm({ ...form, trading_name: e.target.value })}
          className="input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Area</label>
          <select
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            className="input"
          >
            {KZN_AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Hourly rate (R)</label>
          <input
            type="number"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold mb-1 block">About</label>
        <textarea
          rows={4}
          value={form.about ?? ""}
          onChange={(e) => setForm({ ...form, about: e.target.value })}
          className="input resize-none"
          placeholder="Tell potential customers about your experience, your team, and what makes you different..."
        />
      </div>
      <div>
        <label className="text-xs font-semibold mb-1 block">Specialties</label>
        <div className="grid grid-cols-2 gap-2">
          {SPECIALTIES.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:border-brand text-sm"
            >
              <input
                type="checkbox"
                checked={form.specialties.includes(s)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    specialties: e.target.checked
                      ? [...form.specialties, s]
                      : form.specialties.filter((x) => x !== s),
                  })
                }
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 px-3 py-3 bg-emergency-light border border-emergency rounded-lg cursor-pointer text-emergency text-sm font-semibold">
        <input
          type="checkbox"
          checked={form.is_emergency}
          onChange={(e) => setForm({ ...form, is_emergency: e.target.checked })}
        />
        🚨 24/7 emergency callouts
      </label>
      <div>
        <label className="text-xs font-semibold mb-1 block">Google Calendar URL</label>
        <input
          value={form.google_calendar_url ?? ""}
          onChange={(e) => setForm({ ...form, google_calendar_url: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="text-xs font-semibold mb-1 block">Google Place ID</label>
        <input
          value={form.google_place_id ?? ""}
          onChange={(e) => setForm({ ...form, google_place_id: e.target.value })}
          className="input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">PIRB number</label>
          <input
            value={form.pirb_number ?? ""}
            onChange={(e) => setForm({ ...form, pirb_number: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">WhatsApp number</label>
          <input
            value={form.whatsapp_number}
            onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
            className="input"
          />
        </div>
      </div>
      {/* Website & Social Media */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <h3 className="text-sm font-bold text-gray-900 mb-3">🌐 Website & Social Media</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">Website URL</label>
            <input
              type="url"
              value={form.website_url ?? ""}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              className="input"
              placeholder="https://www.yourbusiness.co.za"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Facebook</label>
              <input
                type="url"
                value={form.facebook_url ?? ""}
                onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
                className="input"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Instagram</label>
              <input
                type="url"
                value={form.instagram_url ?? ""}
                onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                className="input"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">TikTok</label>
              <input
                type="url"
                value={form.tiktok_url ?? ""}
                onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
                className="input"
                placeholder="https://tiktok.com/@..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accreditations */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <h3 className="text-sm font-bold text-gray-900 mb-3">📜 Accreditations & Licences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">SESSA registration number</label>
            <input
              value={form.sessa_number ?? ""}
              onChange={(e) => setForm({ ...form, sessa_number: e.target.value })}
              className="input"
              placeholder="e.g. SE-12345"
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">LPGSA registration number</label>
            <input
              value={form.lpgsa_number ?? ""}
              onChange={(e) => setForm({ ...form, lpgsa_number: e.target.value })}
              className="input"
              placeholder="e.g. LP-12345"
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save changes"}
      </button>
    </form>
  );
}
