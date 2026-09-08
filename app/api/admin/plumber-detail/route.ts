import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, privateJson, accessFailure, AccessError, isMissingSchema } from "@/lib/server-access";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  try{
    const {admin}=await requireAdmin(request);
    const id=request.nextUrl.searchParams.get("id");
    if(!z.string().uuid().safeParse(id).success)throw new AccessError("Invalid business reference.",400);
    const plumber=await admin.from("plumbers").select("*").eq("id",id).maybeSingle();
    if(plumber.error)throw new AccessError("Business details could not load.",503);
    if(!plumber.data)throw new AccessError("Business not found.",404);
    const since=new Date(Date.now()-30*86400000).toISOString();
    const [photos,profilePhoto,certifications,bookings,events]=await Promise.all([
      admin.from("photos").select("id",{count:"exact",head:true}).eq("plumber_id",id),
      admin.from("photos").select("id",{count:"exact",head:true}).eq("plumber_id",id).eq("is_profile_photo",true),
      admin.from("certifications").select("id,cert_name").eq("plumber_id",id).limit(100),
      admin.from("bookings").select("id,customer_name,customer_phone,job_description,preferred_datetime,status,notes,created_at").eq("plumber_id",id).order("created_at",{ascending:false}).limit(8),
      admin.from("lead_events").select("event_name").eq("plumber_id",id).gte("created_at",since).limit(1000),
    ]);
    if(photos.error||profilePhoto.error||certifications.error||bookings.error)throw new AccessError("Some business details could not load. No partial view was treated as complete.",503);
    const leadCounts:{whatsapp_click:number|null;call_click:number|null;booking_complete:number|null}={whatsapp_click:0,call_click:0,booking_complete:0};
    if(events.error||events.data?.length===1000){leadCounts.whatsapp_click=null;leadCounts.call_click=null;leadCounts.booking_complete=null;}
    else for(const event of events.data||[])if(event.event_name in leadCounts){const key=event.event_name as keyof typeof leadCounts;leadCounts[key]=(leadCounts[key]||0)+1;}
    return privateJson({plumber:{...plumber.data,has_photos:(photos.count||0)>0,has_profile_photo:(profilePhoto.count||0)>0,has_certs:(certifications.data?.length||0)>0},bookings:bookings.data||[],certifications:certifications.data||[],lead_counts:leadCounts,lead_tracking_status:events.error?(isMissingSchema(events.error)?"not_configured":"unavailable"):events.data?.length===1000?"incomplete":"available"});
  }catch(error){return accessFailure(error);}
}
