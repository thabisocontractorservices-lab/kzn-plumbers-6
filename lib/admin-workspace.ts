import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabase } from "@/lib/supabase/public";
import { AccessError, isMissingSchema } from "@/lib/server-access";
import { splitReviewHistory, type ReviewRecord } from "@/lib/review-history";

export type AdminView = "overview" | "listings" | "claims" | "reviews" | "bookings" | "users" | "policies";
export type FeatureStatus = "available" | "not_configured" | "unavailable";
export type Capabilities = { verification: FeatureStatus; leadEvents: FeatureStatus; bookingOutcomes: FeatureStatus; listingStatus: FeatureStatus };
export const POLICY_AUDIT_SQL = `-- Optional, read-only policy report. This statement makes no database changes.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','plumbers','reviews','certifications','bookings','claims')
ORDER BY tablename, policyname;`;

type ErrorShape = { code?: string; message?: string } | null;
export function statusFromError(error: ErrorShape): FeatureStatus { return !error ? "available" : isMissingSchema(error) ? "not_configured" : "unavailable"; }

export async function adminCapabilities(admin: SupabaseClient): Promise<Capabilities> {
  const [verification,leadEvents,bookingOutcomes,listingStatus] = await Promise.all([
    admin.from("plumbers").select("verification_state,verification_source_url,credential_verified_at,verification_expires_at,source_notes",{head:true}).limit(1),
    admin.from("lead_events").select("id",{head:true}).limit(1),
    admin.from("bookings").select("job_outcome,accepted_at,completed_at",{head:true}).limit(1),
    admin.from("plumbers").select("record_status",{head:true}).limit(1),
  ]);
  return { verification:statusFromError(verification.error), leadEvents:statusFromError(leadEvents.error), bookingOutcomes:statusFromError(bookingOutcomes.error), listingStatus:statusFromError(listingStatus.error) };
}

export async function countRows(admin: SupabaseClient, table: string, column?: string, value?: string | boolean) {
  let q=admin.from(table).select("id",{count:"exact",head:true});
  if (column && value!==undefined) q=q.eq(column,value);
  const result=await q;
  return { value:result.error ? null : result.count ?? 0, status:statusFromError(result.error) };
}

export async function overview(admin: SupabaseClient, capabilities: Capabilities) {
  const [published,pending,claims,users,bookings,reviews] = await Promise.all([
    countRows(admin,"plumbers","is_verified",true), countRows(admin,"plumbers","is_verified",false),
    countRows(admin,"claims","status","pending"),countRows(admin,"profiles"),countRows(admin,"bookings","status","pending"),countRows(admin,"reviews"),
  ]);
  const since=new Date(Date.now()-30*86400000).toISOString();
  let contacts: number|null=null;
  if(capabilities.leadEvents==="available") {
    const result=await admin.from("lead_events").select("id",{count:"exact",head:true}).in("event_name",["whatsapp_click","call_click"]).gte("created_at",since);
    if(!result.error) contacts=result.count ?? 0;
  }
  return { published,pending,claims,users,bookings,reviews,contacts30d:contacts,capabilities };
}

export async function loadReviews(admin: SupabaseClient, businessId?: string) {
  const rows: ReviewRecord[]=[];
  let lastId: string|undefined;
  // Bounded API pages and a visible completeness flag, never the default 1000-row cap.
  for(let n=0;n<50;n++) {
    let query=admin.from("reviews").select("id,plumber_id,reviewer_id,reviewer_name,rating,comment,created_at").order("id").limit(200);
    if(businessId) query=query.eq("plumber_id",businessId);
    if(lastId) query=query.gt("id",lastId);
    const result=await query;
    if(result.error) throw new AccessError("Review records are temporarily unavailable.",503);
    const batch=(result.data ?? []) as ReviewRecord[];
    if(!batch.length) return {rows,complete:true};
    rows.push(...batch); lastId=batch[batch.length-1].id;
  }
  return {rows,complete:false};
}

export async function reviewWorkspace(admin: SupabaseClient, search: string, page: number, mode: string) {
  const {rows,complete}=await loadReviews(admin);
  const groups=splitReviewHistory(rows);
  const currentIds=new Set(groups.current.map(r=>r.id));
  const businessIds=[...new Set(rows.map(r=>r.plumber_id).filter(Boolean))] as string[];
  const names=new Map<string,{trading_name:string;slug:string|null}>();
  for(let i=0;i<businessIds.length;i+=100) {
    const result=await admin.from("plumbers").select("id,trading_name,slug").in("id",businessIds.slice(i,i+100));
    if(result.error) throw new AccessError("Business names could not be loaded.",503);
    for(const p of result.data ?? []) names.set(p.id,p);
  }
  const seenCounts=new Map<string,number>();
  for(const r of rows) if(r.reviewer_id) { const key=`${r.plumber_id}:${r.reviewer_id}`; seenCounts.set(key,(seenCounts.get(key)||0)+1); }
  const counts={current:groups.current.length,history:groups.history.length,total:rows.length,duplicateGroups:[...seenCounts.values()].filter(n=>n>1).length};
  const q=search.toLowerCase();
  const items=rows.map(r=>({...r,business:names.get(r.plumber_id||"")?.trading_name || "Business record unavailable",slug:names.get(r.plumber_id||"")?.slug || null,history_state:!complete?"undetermined":currentIds.has(r.id)?"current":"history"}))
    .filter(r=>(mode==="all"||mode===""||r.history_state===mode) && (!q||`${r.business} ${r.reviewer_name||""} ${r.comment||""}`.toLowerCase().includes(q)))
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id));
  return {items:items.slice((page-1)*25,page*25),total:items.length,page,pageSize:25,counts,complete,notice:complete?"Latest review per signed-in account is current. Earlier submissions are preserved in the database; nothing has been deleted or physically archived.":"The read limit was reached. Current/history classification is withheld until all records can be considered."};
}

export async function policyWorkspace(admin: SupabaseClient, capabilities: Capabilities) {
  const anonymous=getPublicSupabase();
  const probes=[];
  for(const table of ["profiles","certifications"] as const) {
    const total=await countRows(admin,table);
    if(!anonymous) { probes.push({table,visibleRows:null,totalRows:total.value,status:"not_checked",message:"Public database configuration is missing."}); continue; }
    // HEAD probes count public records without fetching account data or certificate URLs.
    const result=await anonymous.from(table).select("id",{count:"exact",head:true}).limit(1);
    const denied=Boolean(result.error && ["42501","PGRST301"].includes(result.error.code));
    probes.push({table,visibleRows:result.error?null:result.count ?? 0,totalRows:total.value,
      status:!result.error && (result.count ?? 0)>0 ? "attention" : denied ? "request_denied" : result.error ? "not_checked" : "no_visible_rows",
      message:!result.error && (result.count ?? 0)>0 ? "Anonymous access can see rows. Review the database policies; this code release has not changed them." : denied ? "The anonymous read was denied. This is one observation, not a complete security audit." : result.error ? "The anonymous access check could not be completed." : "No rows were visible. An empty result does not prove that every policy is restrictive."});
  }
  let certBucket: "private"|"public"|"unknown"="unknown";
  const bucket=await admin.storage.getBucket("certs");
  if(!bucket.error && bucket.data) certBucket=bucket.data.public?"public":"private";
  return {capabilities,probes,certBucket,checkedAt:new Date().toISOString(),policySql:POLICY_AUDIT_SQL,
    notice:"Read-only capability and anonymous-access observations. No policy was changed. Full pg_policies definitions are not available through normal Supabase REST without a separate metadata function; the optional SQL above exports them directly.",
    limitations:["Previously shared certificate signed URLs are not revoked by this release.","Legacy database permissions and role-changing rules still need independent review.","This dashboard never runs migration 007 or arbitrary SQL."]};
}
