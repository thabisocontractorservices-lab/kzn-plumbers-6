import { describe, expect, it } from "vitest";
import { profileSummary, serviceGuidance, profileCompletion } from "../lib/profile-enrichment";
import { isIndexableProfile } from "../lib/content-quality";

describe("factual profile enrichment", () => {
  it("uses recorded facts and distinguishes unclaimed records", () => {
    const text = profileSummary({ trading_name: "Example Plumbing", area: "PMB", specialties: ["Drain cleaning", "Drain cleaning"] });
    expect(text).toContain("Example Plumbing");
    expect(text).toContain("under PMB");
    expect(text).toContain("has not been claimed");
    expect(text.match(/Drain cleaning/g)?.length).toBe(1);
    expect(text).not.toContain("24/7");
    expect(text).not.toContain("certified");
    expect(text).toContain("not confirmation");
  });
  it("does not turn ownership into certification", () => {
    expect(profileSummary({ trading_name: "A", area: "Ballito", profile_id: "p" })).toContain("does not by itself confirm professional registration");
  });
  it("offers questions and valid directory service links", () => {
    const items = serviceGuidance(["Drain cleaning", "Unlisted service"]);
    expect(items[0].guidePath).toBe("/services/blocked-drains");
    expect(items[0].questions[0]).toContain("blockage");
    expect(items[1].guidePath).toBeNull();
  });
  it("does not deindex a published thin profile", () => {
    expect(isIndexableProfile({ is_verified: true, about: null, specialties: [] })).toBe(true);
    expect(profileCompletion({ trading_name: "A", area: "PMB" })).toHaveLength(2);
  });
});
