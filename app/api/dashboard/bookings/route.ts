import { z } from "zod";
import { requireUser,requireSameOrigin,privateJson,accessFailure,AccessError } from "@/lib/server-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adminCapabilities } from "@/lib/admin-workspace";
export const dynamic="force-dynamic";
const Schema=z.object({id:z.string().uuid(),outcome:z.enum(["accepted","declined","won","lost"]),expected_updated_at:z.string().min(1).max(50)});
export async function POST(request:Request){
  try{
    requireSameOrigin(request);const user=await requireUser(request);const admin=getSupabaseAdmin();
    const text=await request.text();if(text.length>4096)throw new AccessError("Request is too large.",413);
    let body:unknown;try{body=JSON.parse(text);}catch{throw new AccessError("Invalid request.",400);}
    const parsed=Schema.safeParse(body);if(!parsed.success)throw new AccessError("Check the booking update.",400);
    const input=parsed.data;
    const own=await admin.from("plumbers").select("id").eq("profile_id",user.id).maybeSingle();
    if(own.error||!own.data)throw new AccessError("Your business profile could not be verified.",403);
    const booking=await admin.from("bookings").select("id,plumber_id,updated_at").eq("id",input.id).eq("plumber_id",own.data.id).maybeSingle();
    if(booking.error||!booking.data)throw new AccessError("Booking not found for your business.",404);
    if(booking.data.updated_at!==input.expected_updated_at)throw new AccessError("This booking changed. Reload the page before updating it.",409);
    const caps=await adminCapabilities(admin);
    const rich=caps.bookingOutcomes==="available";
    if(!rich&&["won","lost"].includes(input.outcome))throw new AccessError("Structured job outcomes are not installed. You can still confirm or decline a booking request.",409);
    const patch:Record<string,unknown>={status:["accepted","won"].includes(input.outcome)?"confirmed":"cancelled"};
    if(rich){patch.job_outcome=input.outcome;if(input.outcome==="accepted")patch.accepted_at=new Date().toISOString();if(["won","lost"].includes(input.outcome))patch.completed_at=new Date().toISOString();}
    const changed=await admin.from("bookings").update(patch).eq("id",input.id).eq("plumber_id",own.data.id).eq("updated_at",input.expected_updated_at).select("*").maybeSingle();
    if(changed.error||!changed.data)throw new AccessError("The update could not be confirmed. Reload before retrying.",409);
    return privateJson({booking:changed.data,outcome_storage:rich?"available":"not_configured"});
  }catch(error){return accessFailure(error);}
}
