import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
