import { describe, expect, it } from "vitest";
import { safeJsonLd, safeStoredJsonLd } from "../lib/json-ld";

describe("JSON-LD serialisation", () => {
  it("escapes script-breaking characters from business data", () => {
    const output = safeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c");
  });

  it("rejects invalid stored JSON-LD", () => {
    expect(safeStoredJsonLd("not-json")).toBe("{}");
  });
});
