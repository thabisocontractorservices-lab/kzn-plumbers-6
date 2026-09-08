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
  const { data, error } = await supabase
    .from("seo_pages")
    .select("slug,h1,meta_title,meta_description,body_html,group_ref,group_name,city_focus,published,index_status,canonical_target,redirect_target")
    .range(from, from + 999);
  if (error) {
    const fallback = await supabase
      .from("seo_pages")
      .select("slug,h1,meta_title,meta_description,body_html,group_ref,group_name,city_focus,published")
      .range(from, from + 999);
    if (fallback.error) throw fallback.error;
    rows.push(...(fallback.data || []));
    if ((fallback.data || []).length < 1000) break;
  } else {
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
}

const prepared = rows.map((row) => {
  const text = plainText(row.body_html || "");
  return { ...row, text, words: text ? text.split(/\s+/).length : 0, hash: hashish(text), vector: termFrequency(text) };
});
const groups = new Map();
for (const row of prepared) {
  const key = row.group_name === "Landing Pages"
    ? `Landing Pages/${row.slug.split("-")[0] || "other"}`
    : row.group_name || row.group_ref || "ungrouped";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const output = [];
for (const [groupKey, group] of groups) {
  const representative = [...group].sort((a, b) => b.words - a.words)[0];
  const hashCounts = new Map(group.map((item) => [item.hash, (group.filter((other) => other.hash === item.hash).length)]));
  for (const row of group) {
    const similarity = representative === row ? 1 : cosine(row.vector, representative.vector);
    const offScope = /(?:cape-town|durbanville)/i.test(row.slug) || /(?:cape town|durbanville)/i.test(`${row.city_focus || ""} ${row.h1 || ""}`);
    const exactDuplicate = (hashCounts.get(row.hash) || 0) > 1;
    let suggested = "keep_review";
    let reason = "Review demand, live inventory, uniqueness, and GSC performance before keeping.";
    if (offScope) {
      suggested = "remove_review";
      reason = "Outside the KwaZulu-Natal proposition.";
    } else if (exactDuplicate) {
      suggested = "merge_review";
      reason = "Exact normalized body duplicate within its template family.";
    } else if (row.words < 180) {
      suggested = "noindex_review";
      reason = "Very thin body; keep indexable only if live inventory and proven demand add unique value.";
    } else if (similarity >= 0.86 && row.words < 450) {
      suggested = "merge_review";
      reason = "High template similarity and limited unique depth.";
    }
    output.push({
      slug: row.slug,
      h1: row.h1,
      group: groupKey,
      city_focus: row.city_focus || "",
      published: row.published,
      words: row.words,
      similarity_to_group_representative: similarity.toFixed(3),
      exact_duplicate_in_group: exactDuplicate,
      current_index_status: row.index_status || "legacy_unclassified",
      suggested_disposition: suggested,
      suggested_target: targetFor(row),
      reason,
    });
  }
}

const reportDir = path.resolve("reports");
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, "seo-page-inventory.csv"), toCsv(output));
await fs.writeFile(path.join(reportDir, "seo-page-inventory-summary.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  readOnly: true,
  total: output.length,
  bySuggestion: counts(output.map((row) => row.suggested_disposition)),
  note: "Suggestions are triage only. Add GSC demand, backlinks, conversion, and live inventory before approving redirects or removals.",
}, null, 2));
console.log(`Wrote ${output.length} rows to reports/seo-page-inventory.csv`);

function plainText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().toLowerCase();
}
function termFrequency(text) {
  const map = new Map();
  for (const word of text.split(/\s+/).filter((item) => item.length > 2)) {
    map.set(word, (map.get(word) || 0) + 1);
  }
  return map;
}
function cosine(a, b) {
  if (!a.size && !b.size) return 1;
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (const [word, count] of a) {
    magnitudeA += count * count;
    dot += count * (b.get(word) || 0);
  }
  for (const count of b.values()) magnitudeB += count * count;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB) || 1);
}
function hashish(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
function targetFor(row) {
  const text = `${row.group_name || ""} ${row.h1 || ""}`.toLowerCase();
  const city = (row.city_focus || "").toLowerCase();
  if (/durbanville|cape town/.test(`${city} ${row.slug}`)) return "";
  const regions = [
    [/pietermaritzburg|\bpmb\b|hilton|howick/, "/plumbers/pietermaritzburg"],
    [/ballito|north coast|salt rock/, "/plumbers/ballito-north-coast"],
    [/richards bay|umhlathuze|empangeni/, "/plumbers/richards-bay"],
    [/newcastle/, "/plumbers/newcastle"],
    [/pinetown|hillcrest|kloof|westville/, "/plumbers/pinetown-hillcrest"],
    [/south coast|port shepstone|margate|scottburgh/, "/plumbers/south-coast"],
    [/durban|ethekwini|umhlanga|berea|morningside/, "/plumbers/durban"],
  ];
  for (const [pattern, target] of regions) if (pattern.test(city)) return target;
  const services = [
    [/drain/, "/services/blocked-drains"], [/geyser/, "/services/geyser-repair"], [/leak detection/, "/services/leak-detection"],
    [/burst pipe/, "/services/burst-pipes"], [/bathroom/, "/services/bathroom-plumbing"], [/solar/, "/services/solar-geyser"],
    [/gas/, "/services/gas-fitting"], [/commercial|industrial/, "/services/commercial"],
  ];
  for (const [pattern, target] of services) if (pattern.test(text)) return target;
  return "/";
}
function counts(values) { return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length])); }
function toCsv(items) {
  const headers = Object.keys(items[0] || { slug: "" });
  return [headers, ...items.map((item) => headers.map((key) => item[key]))].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
function csvCell(value) { const string = String(value ?? ""); return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string; }
