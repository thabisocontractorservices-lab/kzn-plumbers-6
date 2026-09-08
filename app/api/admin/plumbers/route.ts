import { requireAdmin, privateJson, accessFailure, AccessError } from "@/lib/server-access";
export const dynamic="force-dynamic";
export async function GET(request: Request){
  try{
    const {admin}=await requireAdmin(request);
    const plumbers:Array<{id:string;trading_name:string;slug:string|null;profile_id:string|null;is_verified:boolean;area:string}>=[];
    let after:string|undefined;
    for(let batch=0;batch<50;batch++){
      let query=admin.from("plumbers").select("id,trading_name,slug,profile_id,is_verified,area").order("id").limit(200);
      if(after)query=query.gt("id",after);
      const result=await query;
      if(result.error)throw new AccessError("Business list could not load.",503);
      if(!result.data?.length)return privateJson({plumbers:plumbers.sort((a,b)=>a.trading_name.localeCompare(b.trading_name)),complete:true});
      plumbers.push(...result.data);after=result.data[result.data.length-1].id;
    }
    return privateJson({plumbers,complete:false});
  }catch(error){return accessFailure(error);}
}
