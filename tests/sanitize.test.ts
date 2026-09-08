import { describe, expect, it } from "vitest";
import { sanitizeEditorialHtml } from "../lib/sanitize";

describe("editorial HTML sanitiser", () => {
  it("removes scripts, event handlers, and unsafe URL schemes", () => {
    const input = '<h2>Guide</h2><script>alert(1)</script><p onclick="steal()">Text</p><a href="javascript:alert(1)">bad</a>';
    const output = sanitizeEditorialHtml(input);
    expect(output).toContain("<h2>Guide</h2>");
    expect(output).not.toContain("script");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("javascript:");
  });
});
