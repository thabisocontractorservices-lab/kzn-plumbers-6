import type { NextRequest } from "next/server";
import { requireAdmin, privateJson, accessFailure, AccessError } from "@/lib/server-access";
import { adminCapabilities, overview, reviewWorkspace, policyWorkspace, type AdminView } from "@/lib/admin-workspace";

export const dynamic="force-dynamic";
const VIEWS=new Set<AdminView>(["overview","listings","claims","reviews","bookings","users","policies"]);
export async function GET(request: NextRequest) {
  try {
    const {admin}=await requireAdmin(request);
    const raw=request.nextUrl.searchParams;
    const view=(raw.get("view")||"overview") as AdminView;
    if(!VIEWS.has(view)) throw new AccessError("Unknown administration view.",400);
    const page=Math.max(1,Math.min(400,Number.parseInt(raw.get("page")||"1",10)||1));
    const search=(raw.get("q")||"").trim().slice(0,100);
    const filter=raw.get("filter")||"all";
    const capabilities=await adminCapabilities(admin);
    if(view==="overview") return privateJson(await overview(admin,capabilities));
    if(view==="policies") return privateJson(await policyWorkspace(admin,capabilities));
    if(view==="reviews") return privateJson({...await reviewWorkspace(admin,search,page,filter),capabilities});

    const from=(page-1)*25;
    let query;
    if(view==="listings") {
      const optional=capabilities.verification==="available"?",verification_state,verification_source_url,credential_verified_at,verification_expires_at":"";
      const status=capabilities.listingStatus==="available"?",record_status":"";
      query=admin.from("plumbers").select(`id,trading_name,slug,area,profile_id,pirb_number,is_verified,is_certified,whatsapp_number,specialties,created_at,updated_at,photos(count),certifications(count)${optional}${status}`,{count:"exact"});
      if(filter==="published") query=query.eq("is_verified",true);
      if(filter==="pending") query=query.eq("is_verified",false);
      if(filter==="unclaimed") query=query.is("profile_id",null);
      if(search) query=query.ilike("trading_name",`%${search.replace(/[%_]/g,"")}%`);
    } else if(view==="claims") {
      query=admin.from("claims").select("id,plumber_id,claimant_id,phone_entered,status,created_at,admin_notes,resolved_at,plumber:plumbers(trading_name,slug,area),claimant:profiles(full_name,email)",{count:"exact"});
      if(["pending","approved","rejected"].includes(filter)) query=query.eq("status",filter);
    } else if(view==="bookings") {
      query=admin.from("bookings").select("id,plumber_id,customer_name,customer_phone,job_description,preferred_datetime,status,notes,created_at,updated_at,plumber:plumbers(trading_name,slug)",{count:"exact"});
      if(["pending","confirmed","cancelled"].includes(filter)) query=query.eq("status",filter);
      if(search) query=query.ilike("customer_name",`%${search.replace(/[%_]/g,"")}%`);
    } else {
      query=admin.from("profiles").select("id,full_name,email,role,created_at,plumber:plumbers(id,trading_name,slug,area,is_verified)",{count:"exact"});
      if(["plumber","homeowner","admin"].includes(filter)) query=query.eq("role",filter);
      if(search) query=query.ilike("full_name",`%${search.replace(/[%_]/g,"")}%`);
    }
    const result=await query.order("created_at",{ascending:false}).order("id",{ascending:true}).range(from,from+24);
    if(result.error) throw new AccessError(`The ${view} view could not be loaded.`,503);
    return privateJson({items:result.data??[],total:result.count??0,page,pageSize:25,capabilities});
  } catch(error) { return accessFailure(error); }
}
