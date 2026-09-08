import { describe, expect, it } from "vitest";
import { callLink, combinedRating, formatWhatsApp, isLandline, isValidSAPhone, whatsAppLink } from "../lib/utils";

describe("South African contact helpers", () => {
  it("normalises common mobile formats", () => {
    expect(formatWhatsApp("082 123 4567")).toBe("27821234567");
    expect(formatWhatsApp("+27 82 123 4567")).toBe("27821234567");
  });

  it("distinguishes mobile and landline numbers", () => {
    expect(isValidSAPhone("082 123 4567")).toBe(true);
    expect(isLandline("031 555 0123")).toBe(true);
    expect(isLandline("082 123 4567")).toBe(false);
  });

  it("encodes contact links safely", () => {
    expect(callLink("031 555 0123")).toBe("tel:+27315550123");
    expect(whatsAppLink("0821234567", "Burst pipe & leak")).toBe("https://wa.me/27821234567?text=Burst%20pipe%20%26%20leak");
  });
});

describe("rating helper", () => {
  it("combines rating sources without inventing reviews", () => {
    expect(combinedRating(4.5, 10, 5, 2)).toEqual({ rating: 4.6, count: 12 });
    expect(combinedRating(null, 0, null, 0)).toEqual({ rating: null, count: 0 });
  });
});
