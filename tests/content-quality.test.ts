import { describe, expect, it } from "vitest";
import { isIndexableProfile, isLikelyGeneratedProfileAbout, usableProfileAbout } from "../lib/content-quality";

describe("profile description quality gate", () => {
  it("rejects the legacy generated templates and malformed filler", () => {
    expect(isLikelyGeneratedProfileAbout("Solarvest serves homeowners and small businesses in Ballito, KwaZulu-Natal, offering . Contact via WhatsApp for a quote.")).toBe(true);
    expect(usableProfileAbout("TOPSUN is a verified plumbing business based in Durban North, KwaZulu-Natal. Services include . Quotes provided upfront.")).toBeNull();
  });

  it("keeps a substantive business-supplied description", () => {
    const about = "Our team provides CCTV drain inspection, hydro-jetting and written condition reports for homes, estates and commercial sites across the North Coast.";
    expect(usableProfileAbout(about)).toBe(about);
    expect(isIndexableProfile({ about })).toBe(true);
  });

  it("keeps empty imported records out of the index until they gain a real signal", () => {
    expect(isIndexableProfile({ about: "Generated filler", specialties: [], google_review_count: 0, photos: [] })).toBe(false);
    expect(isIndexableProfile({ profile_id: "owner" })).toBe(true);
    expect(isIndexableProfile({ google_review_count: 2 })).toBe(true);
  });
});
