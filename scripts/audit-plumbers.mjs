import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key before running this read-only audit.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = [];
for (let from = 0; ; from += 1000) {
  let result = await supabase.from("plumbers").select("id,trading_name,slug,area,whatsapp_number,pirb_number,website_url,profile_id,is_verified,is_certified,verification_state,last_checked_at,specialties,about,google_review_count,photos(photo_url)").range(from, from + 999);
  if (result.error) result = await supabase.from("plumbers").select("id,trading_name,slug,area,whatsapp_number,pirb_number,website_url,profile_id,is_verified,is_certified,specialties,about,google_review_count,photos(photo_url)").range(from, from + 999);
  if (result.error) throw result.error;
  rows.push(...(result.data || []));
  if ((result.data || []).length < 1000) break;
}

const candidates = [];
for (const [field, normalise] of [["trading_name", normalName], ["whatsapp_number", normalPhone], ["pirb_number", normalName], ["website_url", normalDomain]]) {
  const groups = new Map();
  for (const row of rows) {
    const value = normalise(row[field]);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  for (const [value, group] of groups) {
    if (group.length < 2) continue;
    candidates.push({ match_type: field, match_value: value, record_count: group.length, plumber_ids: group.map((row) => row.id).join("|"), trading_names: group.map((row) => row.trading_name).join(" | "), areas: [...new Set(group.map((row) => row.area))].join(" | "), action: "manual_entity_review" });
  }
}

const suspiciousPattern = /(?:municipality|school|college|university|retail store|energy management|solar solutions|construction|civil|engineering consultant)$/i;
const auditRows = rows.map((row) => {
  const reasons = [];
  if (!row.whatsapp_number) reasons.push("missing_phone");
  if (!row.specialties?.length) reasons.push("missing_services");
  if (!row.about || row.about.trim().length < 80) reasons.push("thin_description");
  if (isGeneratedDescription(row.about)) reasons.push("generated_template_description");
  if (suspiciousPattern.test(row.trading_name.trim())) reasons.push("entity_type_review");
  if (row.is_certified && !row.pirb_number) reasons.push("certified_without_pirb_number");
  if (row.is_certified && row.verification_state && row.verification_state !== "credential_verified") reasons.push("legacy_certification_conflict");
  const completeness = [row.whatsapp_number, row.specialties?.length, row.about?.length >= 80 && !isGeneratedDescription(row.about), row.profile_id, row.website_url, row.pirb_number].filter(Boolean).length;
  const suggestedIndexable = Boolean(row.profile_id || ((row.about?.trim().length || 0) >= 60 && !isGeneratedDescription(row.about)) || (row.google_review_count || 0) > 0 || row.specialties?.length || row.photos?.length);
  return { id: row.id, slug: row.slug || "", trading_name: row.trading_name, area: row.area, published: row.is_verified, claimed: Boolean(row.profile_id), verification_state: row.verification_state || (row.profile_id ? "business_claimed" : "directory_record"), completeness_score_6: completeness, suggested_indexable: suggestedIndexable, review_reasons: reasons.join("|"), suggested_action: reasons.length ? "manual_review" : "retain_review" };
});

const reportDir = path.resolve("reports");
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, "plumber-data-audit.csv"), toCsv(auditRows));
await fs.writeFile(path.join(reportDir, "plumber-duplicate-candidates.csv"), toCsv(candidates));
await fs.writeFile(path.join(reportDir, "plumber-data-audit-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), readOnly: true, total: rows.length, published: rows.filter((row) => row.is_verified).length, claimed: rows.filter((row) => row.profile_id).length, suggestedIndexable: auditRows.filter((row) => row.suggested_indexable).length, manualReview: auditRows.filter((row) => row.review_reasons).length, reviewReasonCounts: countReasons(auditRows), duplicateCandidateGroups: candidates.length, note: "Candidates are not automatic deletions. Multi-branch businesses and shared numbers require human entity resolution." }, null, 2));
console.log(`Wrote ${rows.length} records and ${candidates.length} duplicate groups to reports/`);

function countReasons(items) {
  const counts = {};
  for (const item of items) for (const reason of item.review_reasons.split("|").filter(Boolean)) counts[reason] = (counts[reason] || 0) + 1;
  return counts;
}
function isGeneratedDescription(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return / serves homeowners and small businesses in .+kwaZulu-Natal, offering /i.test(text)
    || /^operating across .+ and the surrounding KZN region, .+ specialises in /i.test(text)
    || / is a (?:PIRB-certified|verified) plumbing business based in .+KwaZulu-Natal\. Services include /i.test(text)
    || /^based in .+, .+ has been providing .+ to homes and businesses in KwaZulu-Natal\./i.test(text)
    || /(?:offering|services include)\s*\./i.test(text);
}
function normalName(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function normalPhone(value) { const digits = String(value || "").replace(/\D/g, ""); return digits.startsWith("27") ? digits.slice(2) : digits.replace(/^0/, ""); }
function normalDomain(value) { if (!value) return ""; try { return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function toCsv(items) { const headers = Object.keys(items[0] || { id: "" }); return [headers, ...items.map((item) => headers.map((key) => item[key]))].map((row) => row.map(csvCell).join(",")).join("\n") + "\n"; }
function csvCell(value) { const string = String(value ?? ""); return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string; }
