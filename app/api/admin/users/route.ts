import { requireAdmin, privateJson, accessFailure, AccessError } from "@/lib/server-access";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const {admin}=await requireAdmin(request);
    const page=Math.max(1,Number.parseInt(new URL(request.url).searchParams.get("page")||"1",10)||1);
    const result=await admin.from("profiles").select("id,full_name,email,role,created_at,plumber:plumbers(id,trading_name,area,is_verified,slug)",{count:"exact"}).order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1);
    if(result.error)throw new AccessError("Accounts could not load.",503);
    return privateJson({users:result.data||[],total:result.count,page,pageSize:50});
  }catch(error){return accessFailure(error);}
}
