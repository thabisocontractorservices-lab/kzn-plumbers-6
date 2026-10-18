import { describe, expect, it } from "vitest";
import { pageType } from "../lib/outcome-events";

describe("outcome event page labels", () => {
  it("labels public page types without exposing the address", () => {
    expect(pageType("/")).toBe("home");
    expect(pageType("/plumber/sipho-plumbing-solutions-1")).toBe("profile");
    expect(pageType("/plumbers/durban")).toBe("area");
    expect(pageType("/services/blocked-drains")).toBe("service");
    expect(pageType("/blog/some-article")).toBe("blog");
    expect(pageType("/get-estimate")).toBe("estimate");
    expect(pageType("/find-certified-plumber-durban")).toBe("guide");
  });
});
