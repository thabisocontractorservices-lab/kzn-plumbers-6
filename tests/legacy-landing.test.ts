import { describe, expect, it } from "vitest";
import { safeLegacyLanding } from "../lib/legacy-landing";

const legacy = { slug: "compliance-pinetown", group_name: "Landing Pages", city_focus: "Pinetown", body_html: '<h2>Why hire a plumber?</h2><p>Every plumber listed for Pinetown is registered.</p>' };
describe("legacy landing page accuracy", () => {
  it("replaces the identified shared template with factual metadata and useful questions", () => {
    const result = safeLegacyLanding(legacy)!;
    expect(result.heading).toBe("Plumbing compliance in Pinetown");
    expect(result.title).toBe("Plumbing compliance in Pinetown | KZN Plumbers");
    expect(result.description).toContain("confirm services, coverage and costs directly");
    expect(result.title).not.toMatch(/verified|guarantee/i);
    expect(result.advice.join(" ")).not.toMatch(/R\d|every plumber|all plumbers|within minutes/i);
  });
  it("uses the correct service filter for a leak landing", () => {
    const result = safeLegacyLanding({ ...legacy, slug: "leak-newcastle", city_focus: "Newcastle" })!;
    expect(result.serviceSlug).toBe("leak-detection");
    expect(result.heading).toBe("Leak detection in Newcastle");
  });
  it("does not treat general or KZN as a town", () => {
    for (const city_focus of ["general", "KZN", "KwaZulu-Natal", null]) {
      const result = safeLegacyLanding({ ...legacy, slug: "pricing-general", city_focus })!;
      expect(result.heading).toBe("Plumber pricing in KwaZulu-Natal");
      expect(result.description).not.toMatch(/in general/i);
    }
  });
  it("leaves other editorial groups and edited pages intact", () => {
    expect(safeLegacyLanding({ ...legacy, group_name: "Geyser Services" })).toBeNull();
    expect(safeLegacyLanding({ ...legacy, body_html: "<p>Individually reviewed content.</p>" })).toBeNull();
    expect(safeLegacyLanding({ ...legacy, slug: "unknown-pinetown" })).toBeNull();
  });
});
