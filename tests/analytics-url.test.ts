import { describe, expect, it } from "vitest";
import { analyticsPath, cleanAnalyticsUrl } from "../lib/analytics-url";

describe("analytics URL cleaning", () => {
  it("keeps the page and marketing tags", () => {
    expect(cleanAnalyticsUrl("https://www.kznplumbers.co.za/get-estimate?utm_source=facebook&utm_campaign=geyser&fbclid=abc"))
      .toBe("https://www.kznplumbers.co.za/get-estimate?utm_source=facebook&utm_campaign=geyser&fbclid=abc");
    expect(cleanAnalyticsUrl("https://www.kznplumbers.co.za/plumber/north-coast-plumbers")).toBe("https://www.kznplumbers.co.za/plumber/north-coast-plumbers");
  });
  it("removes private details", () => {
    expect(cleanAnalyticsUrl("https://www.kznplumbers.co.za/get-estimate/received?ref=KZN-1048&t=secret"))
      .toBe("https://www.kznplumbers.co.za/get-estimate/received");
    expect(cleanAnalyticsUrl("https://www.kznplumbers.co.za/?q=082+123+4567&area=durban")).toBe("https://www.kznplumbers.co.za/?area=durban");
    expect(analyticsPath("/admin/leads")).toBe("/private");
    expect(analyticsPath("/dashboard/invoices/3f1c2b9a-1111-4222-8333-123456789abc")).toBe("/dashboard/invoices/[id]");
  });
});
