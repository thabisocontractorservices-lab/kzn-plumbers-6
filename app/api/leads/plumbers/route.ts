import { NextRequest } from "next/server";
import { z } from "zod";
import { accessFailure, privateJson } from "@/lib/server-access";
import { findEligiblePlumbers, getEligiblePlumber } from "@/lib/leads-server";
import { getLeadArea, getLeadService, getLeadUrgency } from "@/lib/leads";

export const dynamic = "force-dynamic";

/**
 * GET /api/leads/plumbers?area=durban-north&service=blocked_drain&urgency=today&suburb=Westville
 * GET /api/leads/plumbers?id=<plumber uuid>
 * Public, read-only. Returns claimed, lead-enabled plumbers only — never phone numbers.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const id = q.get("id");
    const service = getLeadService(q.get("service"))?.key ?? "other";
    const urgency = getLeadUrgency(q.get("urgency"))?.key ?? "planning";
    if (id) {
      if (!z.string().uuid().safeParse(id).success) return privateJson({ plumber: null });
      return privateJson({ plumber: await getEligiblePlumber(id, service, urgency) });
    }
    const area = getLeadArea(q.get("area"));
    if (!area) return privateJson({ error: "Choose your area first." }, 400);
    const suburb = (q.get("suburb") || "").slice(0, 80);
    const result = await findEligiblePlumbers(area.key, service, urgency, suburb, 6);
    return privateJson(result);
  } catch (error) { return accessFailure(error); }
}
