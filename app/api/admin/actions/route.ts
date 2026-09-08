import type { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireSameOrigin, privateJson, accessFailure, AccessError } from "@/lib/server-access";
import { adminCapabilities } from "@/lib/admin-workspace";

export const dynamic="force-dynamic";
const Schema=z.object({
  action:z.enum(["publish","unpublish","record_credential","clear_credential","approve_claim","reject_claim","confirm_booking","cancel_booking"]),
  id:z.string().uuid(),
  expected_updated_at:z.string().max(50).optional(),
  reason:z.string().trim().max(1000).optional(),
  source_url:z.string().url().max(1000).optional(),
  credential_number:z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const {admin}=await requireAdmin(request);
    const raw=await request.text();
    if(raw.length>8192) throw new AccessError("Request is too large.",413);
    let body:unknown;
    try{body=JSON.parse(raw);}catch{throw new AccessError("Invalid request.",400);}
    const parsed=Schema.safeParse(body);
    if(!parsed.success) throw new AccessError("Check the action fields.",400);
    const input=parsed.data;
    const caps=await adminCapabilities(admin);
    const now=new Date().toISOString();

    if(["publish","unpublish","record_credential","clear_credential"].includes(input.action)) {
      const read=await admin.from("plumbers").select("id,slug,trading_name,profile_id,pirb_number,is_verified,updated_at").eq("id",input.id).maybeSingle();
      if(read.error) throw new AccessError("Could not load the business for this action.",503);
      if(!read.data) throw new AccessError("Business not found.",404);
      if(!input.expected_updated_at || input.expected_updated_at!==read.data.updated_at) throw new AccessError("The business changed since this screen loaded. Refresh before trying again.",409);
      const patch:Record<string,unknown>={};
      if(input.action==="publish"||input.action==="unpublish") {
        patch.is_verified=input.action==="publish";
        if(caps.listingStatus==="available") patch.record_status=input.action==="publish"?"published":"suspended";
      } else {
        if(caps.verification!=="available") throw new AccessError("Credential evidence storage is not installed. This release does not turn an old certification flag into verified proof.",409);
        const clearing=input.action==="clear_credential";
        if(!clearing) {
          if(!input.source_url || new URL(input.source_url).protocol!=="https:" || !input.credential_number || !input.reason?.trim()) throw new AccessError("Provide the registration number, HTTPS evidence source and check notes.",400);
          if(input.credential_number!==read.data.pirb_number) throw new AccessError("The entered number must match the registration number on this profile.",409);
        }
        const previousNotes=await admin.from("plumbers").select("source_notes").eq("id",input.id).maybeSingle();
        if(previousNotes.error)throw new AccessError("Evidence notes could not be loaded; no credential change was applied.",503);
        const evidenceNote=`${now}: ${clearing?"Credential label withdrawn":input.reason}`;
        patch.source_notes=[previousNotes.data?.source_notes,evidenceNote].filter(Boolean).join("\n");
        const expiry=new Date(); expiry.setMonth(expiry.getMonth()+6);
        Object.assign(patch,{
          verification_state:clearing?(read.data.profile_id?"business_claimed":"directory_record"):"credential_verified",
          is_certified:!clearing,
          verification_source_url:clearing?null:input.source_url,
          credential_verified_at:clearing?null:now,
          verification_expires_at:clearing?null:expiry.toISOString(),
        });
      }
      const changed=await admin.from("plumbers").update(patch).eq("id",input.id).eq("updated_at",input.expected_updated_at).select("id").maybeSingle();
      if(changed.error) throw new AccessError("Business update failed. Refresh to verify its current state.",503);
      if(!changed.data) throw new AccessError("A concurrent edit occurred. Refresh before trying again.",409);
      revalidatePath(`/plumber/${read.data.slug||input.id}`);
    } else if(input.action==="approve_claim"||input.action==="reject_claim") {
      if(!input.reason || input.reason.trim().length<10) throw new AccessError("Record the ownership evidence checked or the reason for rejection (at least 10 characters).",400);
      const claim=await admin.from("claims").select("id,plumber_id,claimant_id,status,admin_notes").eq("id",input.id).maybeSingle();
      if(claim.error) throw new AccessError("Could not load the claim.",503);
      if(!claim.data || claim.data.status!=="pending") throw new AccessError("This claim is no longer pending. Refresh the list.",409);
      if(input.action==="approve_claim") {
        const account=await admin.auth.admin.getUserById(claim.data.claimant_id);
        if(account.error||!account.data.user?.email_confirmed_at) throw new AccessError("The claimant must have a confirmed account before profile access is transferred.",409);
        const business=await admin.from("plumbers").select("id,profile_id,slug").eq("id",claim.data.plumber_id).maybeSingle();
        if(business.error||!business.data) throw new AccessError("The claimed business could not be loaded.",503);
        if(business.data.profile_id && business.data.profile_id!==claim.data.claimant_id) throw new AccessError("This listing is already controlled by another account. No ownership was changed.",409);
        if(!business.data.profile_id) {
          const link=await admin.from("plumbers").update({profile_id:claim.data.claimant_id}).eq("id",claim.data.plumber_id).is("profile_id",null).select("id").maybeSingle();
          if(link.error) throw new AccessError("Ownership link failed; the account may already own a listing. Refresh before retrying.",409);
          if(!link.data) throw new AccessError("Another request claimed the business first. Refresh the list.",409);
        }
        // This conditional update preserves administrator roles and never trusts raw user metadata.
        const role=await admin.from("profiles").update({role:"plumber"}).eq("id",claim.data.claimant_id).eq("role","homeowner");
        if(role.error) throw new AccessError("The ownership link was saved, but account setup needs a retry. The claim remains pending; do not relink it to somebody else.",503);
        revalidatePath(`/plumber/${business.data.slug||business.data.id}`);
      }
      const resolved=await admin.from("claims").update({status:input.action==="approve_claim"?"approved":"rejected",resolved_at:now,admin_notes:input.reason}).eq("id",input.id).eq("status","pending").select("id").maybeSingle();
      if(resolved.error || !resolved.data) throw new AccessError("The claim status could not be confirmed. Refresh; an ownership link may already have been saved.",503);
    } else {
      const booking=await admin.from("bookings").select("id,status,updated_at").eq("id",input.id).maybeSingle();
      if(booking.error||!booking.data) throw new AccessError("Booking could not be loaded.",404);
      if(!input.expected_updated_at || input.expected_updated_at!==booking.data.updated_at) throw new AccessError("The booking changed. Refresh before updating it.",409);
      const changed=await admin.from("bookings").update({status:input.action==="confirm_booking"?"confirmed":"cancelled"}).eq("id",input.id).eq("updated_at",input.expected_updated_at).select("id").maybeSingle();
      if(changed.error || !changed.data) throw new AccessError("The booking update could not be confirmed. Refresh before retrying.",409);
    }
    revalidateTag("public-directory","max");
    return privateJson({ok:true,message:"Saved. Public pages may take a few minutes to refresh."});
  } catch(error) {return accessFailure(error);}
}
