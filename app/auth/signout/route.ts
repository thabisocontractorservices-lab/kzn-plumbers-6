import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { AccessError, accessFailure, requireSameOrigin } from "@/lib/server-access";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new AccessError("Sign out could not be completed. Please try again.", 503);
    const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return accessFailure(error); }
}
