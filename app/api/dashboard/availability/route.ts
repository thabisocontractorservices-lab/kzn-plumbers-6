import { z } from "zod";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser,requireSameOrigin,AccessError,accessFailure,privateJson,isMissingSchema } from "@/lib/server-access";
export const dynamic="force-dynamic";
const Schema=z.object({plumber_id:z.string().uuid(),status:z.enum(["available","busy","unavailable"])});
export async function POST(request:Request){
  try{
    requireSameOrigin(request);const user=await requireUser(request),admin=getSupabaseAdmin();
    const raw=await request.text();if(raw.length>4096)throw new AccessError("Request too large.",413);
    let body:unknown;try{body=JSON.parse(raw);}catch{throw new AccessError("Invalid request.",400);}
    const input=Schema.safeParse(body);if(!input.success)throw new AccessError("Invalid status.",400);
    const own=await admin.from("plumbers").select("id,updated_at").eq("id",input.data.plumber_id).eq("profile_id",user.id).maybeSingle();
    if(own.error||!own.data)throw new AccessError("This business is not linked to your account.",403);
    const extended=await admin.from("plumbers").select("accepts_new_work,last_checked_at",{head:true}).eq("id",own.data.id).limit(1);
    if(extended.error&&!isMissingSchema(extended.error))throw new AccessError("Availability support could not be checked.",503);
    const rich=!extended.error;
    const patch:Record<string,unknown>={availability_status:input.data.status};
    if(rich){patch.accepts_new_work=input.data.status==="available";patch.last_checked_at=new Date().toISOString();}
    const result=await admin.from("plumbers").update(patch).eq("id",own.data.id).eq("profile_id",user.id).eq("updated_at",own.data.updated_at).select("id").maybeSingle();
    if(result.error||!result.data)throw new AccessError("Status could not be confirmed. Refresh before trying again.",409);
    revalidateTag("public-directory","max");
    return privateJson({saved:true,confirmed:rich&&input.data.status==="available",message:rich?"Availability saved; public pages refresh shortly.":"Status saved. A dated taking-work badge is unavailable with the legacy schema."});
  }catch(error){return accessFailure(error);}
}
