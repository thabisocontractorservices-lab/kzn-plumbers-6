import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DIRECTORY_MAX_PAGE, parseDirectorySearch, normaliseAreaKey, normaliseServiceKey } from "@/lib/directory";
import { searchPublicPlumbers } from "@/lib/directory-data";

const QuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  area: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().max(40).optional().default(""),
  filter: z.enum(["all", "credential", "claimed", "available", "emergency"]).optional().default("all"),
  emergency: z.enum(["1", "0", "true", "false"]).optional(),
  sort: z.enum(["recommended", "rated", "name"]).optional().default("recommended"),
  page: z.coerce.number().int().min(1).max(DIRECTORY_MAX_PAGE).optional().default(1),
  limit: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || (parsed.data.area && !normaliseAreaKey(parsed.data.area)) ||
      (parsed.data.service && !normaliseServiceKey(parsed.data.service))) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const input = parsed.data;
  const search = parseDirectorySearch({ ...input, page: String(input.page), limit: String(input.limit) });
  try {
    const result = await searchPublicPlumbers(search, input.limit);
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    // Original read errors are logged server-side; never misreport an outage as no matches.
    return NextResponse.json({ error: "Directory search is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
