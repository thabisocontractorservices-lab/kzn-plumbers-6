/**
 * Google Places API (New) v1 wrapper.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 */

const PLACES_BASE = "https://places.googleapis.com/v1/places";

export interface GooglePlaceReview {
  name?: string;
  rating: number;
  text?: { text: string };
  originalText?: { text: string };
  authorAttribution: {
    displayName: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime: string;
  relativePublishTimeDescription?: string;
}

export interface GooglePlaceDetails {
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: GooglePlaceReview[];
  googleMapsUri?: string;
  formattedAddress?: string;
}

export class PlacesAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly placeId: string,
  ) {
    super(message);
    this.name = "PlacesAPIError";
  }
}

/**
 * Fetch live details for a Google Place ID.
 * Returns rating, review count, and the latest 5 reviews.
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails> {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }
  if (!placeId) {
    throw new Error("placeId is required");
  }

  const url = `${PLACES_BASE}/${encodeURIComponent(placeId)}`;
  const fieldMask = [
    "displayName",
    "rating",
    "userRatingCount",
    "reviews",
    "googleMapsUri",
    "formattedAddress",
  ].join(",");

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    // Cache for 6 hours at the edge to stay under quota
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new PlacesAPIError(
      `Places API ${res.status}: ${body}`,
      res.status,
      placeId,
    );
  }

  return res.json();
}

/** Generate the public "Write a Google Review" deep link. */
export function reviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/** Generate the Google Maps deep link for a place. */
export function mapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}
