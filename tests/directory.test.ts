import { describe, expect, it } from "vitest";
import { DIRECTORY_AREAS, DIRECTORY_SERVICES, normaliseAreaKey, normaliseServiceKey } from "../lib/directory";
import { REGIONS } from "../lib/regions";
import { SERVICE_GUIDES } from "../lib/services";

describe("directory taxonomy", () => {
  it("has unique public keys", () => {
    expect(new Set(DIRECTORY_AREAS.map((item) => item.key)).size).toBe(DIRECTORY_AREAS.length);
    expect(new Set(DIRECTORY_SERVICES.map((item) => item.key)).size).toBe(DIRECTORY_SERVICES.length);
    expect(new Set(REGIONS.map((item) => item.slug)).size).toBe(REGIONS.length);
  });

  it("normalises database values into public keys", () => {
    expect(normaliseAreaKey("PMB")).toBe("pietermaritzburg");
    expect(normaliseAreaKey("durban")).toBe("durban");
    expect(normaliseServiceKey("Drain cleaning")).toBe("blocked-drains");
  });

  it("provides guidance for every public service", () => {
    expect(SERVICE_GUIDES).toHaveLength(DIRECTORY_SERVICES.length);
    for (const guide of SERVICE_GUIDES) {
      expect(guide.questions.length).toBeGreaterThanOrEqual(3);
      expect(guide.intro.length).toBeGreaterThan(80);
      expect(guide.urgentNote.length).toBeGreaterThan(40);
    }
  });
});
