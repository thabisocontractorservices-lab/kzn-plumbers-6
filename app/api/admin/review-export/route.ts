import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, accessFailure, AccessError } from "@/lib/server-access";
import { loadReviews } from "@/lib/admin-workspace";
import { splitReviewHistory } from "@/lib/review-history";

export const dynamic="force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const {admin}=await requireAdmin(request);
    const result=await loadReviews(admin);
    if(!result.complete) throw new AccessError("Too many reviews for a complete export. No incomplete archive was generated.",409);
    const {current,history}=splitReviewHistory(result.rows);
    const scope=request.nextUrl.searchParams.get("scope")==="history"?"history":"all";
    const text=JSON.stringify({
      exported_at:new Date().toISOString(),
      note:"Private review history export. This is not a full database backup. No database records have been removed or archived by this download.",
      policy:"Latest review per non-null account/business is current; independent legacy guest reviews remain separate.",
      counts:{stored:result.rows.length,current:current.length,earlier:history.length},
      fields:["id","plumber_id","reviewer_id","reviewer_name","rating","comment","created_at"],
      reviews:scope==="history"?history:result.rows,
    },null,2);
    return new NextResponse(text,{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="kzn-review-${scope}-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"private, no-store","Vary":"Cookie, Authorization","X-Content-Type-Options":"nosniff"}});
  }catch(error){return accessFailure(error);}
}
