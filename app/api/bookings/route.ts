import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/src/supabaseClient";
import { z } from "zod";

const Schema = z.object({
  plumber_id: z.string().uuid(),
  customer_name: z.string().min(2),
  customer_phone: z.string().min(7),
  customer_email: z.string().email().optional(),
  job_description: z.string().min(5),
  preferred_datetime: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid datetime",
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      ...parsed.data,
      customer_id: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: Trigger WhatsApp Business API notification to plumber here.
  // For now, the client redirects the user to wa.me with a pre-filled summary.

  return NextResponse.json({ booking: data });
}
