import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { getSitemapEntries, type SitemapType } from "@/lib/directory-sitemaps";

const INDEXNOW_KEY="001e7b24e19455300da367300ac77b65";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(process.env.VERCEL_ENV!=="production")return NextResponse.json({error:"Search-engine submission is disabled outside production."},{status:409});
  try{
    const types:SitemapType[]=["core","regions","services","profiles","content","blog"];
    const entries=await Promise.all(types.map(type=>getSitemapEntries(type)));
    const urls=[...new Set(entries.flat().map(entry=>entry.loc))];
    let submitted=0;
    for(let i=0;i<urls.length;i+=10000){
      const chunk=urls.slice(i,i+10000);
      const response=await fetch("https://api.indexnow.org/indexnow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({host:new URL(SITE_URL).host,key:INDEXNOW_KEY,keyLocation:`${SITE_URL}/${INDEXNOW_KEY}.txt`,urlList:chunk}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)return NextResponse.json({error:"Search-engine submission was not completed.",submitted,statusCode:response.status},{status:502,headers:{"Cache-Control":"no-store"}});
      submitted+=chunk.length;
    }
    return NextResponse.json({ok:true,submitted},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Could not assemble the complete indexable URL set. Nothing further was submitted."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
