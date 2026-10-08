import { describe, expect, it } from "vitest";
import {
  cleanAttribution, deriveSource, doesService, estimateRange, formatEstimate, leadWhatsAppMessage, leadWhatsAppUrl,
  plumberScore, rollUpLeadStatus, servesArea,
} from "../lib/leads";

describe("estimates", () => {
  it("rounds and applies the urgency premium", () => {
    const rule = { service_key: "blocked_drain", low: 650, high: 1800 };
    expect(estimateRange(rule, "planning")).toEqual({ low: 650, high: 1800 });
    expect(estimateRange(rule, "today")).toEqual({ low: 750, high: 2050 });
    expect(estimateRange(rule, "emergency")).toEqual({ low: 900, high: 2450 });
  });
  it("returns no estimate when prices are blank or broken", () => {
    expect(estimateRange({ service_key: "other", low: null, high: null }, "today")).toBeNull();
    expect(estimateRange({ service_key: "x", low: 900, high: 100 }, "today")).toBeNull();
    expect(formatEstimate(8500, 18000)).toBe("R8,500 – R18,000");
  });
});

describe("matching", () => {
  const p = { id: "1", area: "Durban North", service_areas: ["Westville", "Pinetown"], specialties: ["Drain cleaning"] };
  it("matches the plumber's main area, extra areas and suburbs", () => {
    expect(servesArea(p, "durban-north")).toBe(true);
    expect(servesArea(p, "pinetown")).toBe(true);
    expect(servesArea(p, "pietermaritzburg", "Westville")).toBe(true);
    expect(servesArea(p, "newcastle")).toBe(false);
  });
  it("matches services, with general jobs open to everyone", () => {
    expect(doesService(p, "blocked_drain")).toBe(true);
    expect(doesService(p, "gas_fitting")).toBe(false);
    expect(doesService(p, "toilet")).toBe(true);
  });
  it("ranks reviewed plumbers with photos above empty profiles", () => {
    const strong = { ...p, google_rating: 4.8, google_review_count: 60, has_photo: true, photo_count: 6 };
    const empty = { ...p };
    expect(plumberScore(strong, "blocked_drain", "today")).toBeGreaterThan(plumberScore(empty, "blocked_drain", "today"));
  });
});

describe("lead status roll-up", () => {
  it("moves forward only", () => {
    expect(rollUpLeadStatus("sent", "accepted")).toBe("accepted");
    expect(rollUpLeadStatus("quoted", "accepted")).toBe("quoted");
    expect(rollUpLeadStatus("quoted", "won")).toBe("won");
    expect(rollUpLeadStatus("invalid", "accepted")).toBe("invalid");
    expect(rollUpLeadStatus("sent", "declined")).toBe("sent");
  });
});

describe("attribution", () => {
  it("keeps only known fields and labels the source", () => {
    const a = cleanAttribution({ utm_source: "facebook", utm_campaign: "geyser-oct", evil: "<script>", gclid: "" });
    expect(a).toEqual({ utm_source: "facebook", utm_campaign: "geyser-oct" });
    expect(deriveSource(a)).toEqual({ source: "facebook", medium: "unknown", campaign: "geyser-oct" });
    expect(deriveSource({ gclid: "abc" }).source).toBe("google");
    expect(deriveSource({ referrer: "https://www.google.com/" })).toMatchObject({ source: "google", medium: "organic" });
    expect(deriveSource({ page: "/plumber/acme" })).toMatchObject({ source: "directory", medium: "profile" });
  });
});

describe("WhatsApp confirmation", () => {
  it("prefills the reference and job, but no contact details", () => {
    const msg = leadWhatsAppMessage({ ref: "KZN-1048", service_label: "Blocked drain", suburb: "Westville", area_label: "Durban North", urgency: "today" });
    expect(msg).toContain("Reference: KZN-1048");
    expect(msg).toContain("Urgency: Today");
    expect(msg).not.toMatch(/\d{9,}/);
    expect(leadWhatsAppUrl("hi", "27609922848")).toBe("https://wa.me/27609922848?text=hi");
  });
});
