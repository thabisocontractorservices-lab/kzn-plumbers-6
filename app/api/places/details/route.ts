import { NextResponse, type NextRequest } from "next/server";
import { getPlaceDetails, PlacesAPIError } from "@/lib/google/places";

/**
 * GET /api/places/details?placeId=ChIJ...
 * Returns live Google Places data (rating, review count, latest reviews).
 * Cached for 6h at the edge via the underlying fetch.
 */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json(
      { error: "placeId query param is required" },
      { status: 400 },
    );
  }

  try {
    const details = await getPlaceDetails(placeId);
    return NextResponse.json(details, {
      headers: {
        "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    if (err instanceof PlacesAPIError) {
      return NextResponse.json(
        { error: err.message, placeId: err.placeId },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
