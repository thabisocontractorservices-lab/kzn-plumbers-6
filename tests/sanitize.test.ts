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

  it("keeps YouTube embeds and strips every other iframe", () => {
    const yt = sanitizeEditorialHtml('<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/ADewLwTbX9c" title="Video" allowfullscreen></iframe></figure>');
    expect(yt).toContain('src="https://www.youtube-nocookie.com/embed/ADewLwTbX9c"');
    expect(yt).toContain('class="video-embed"');
    const bad = sanitizeEditorialHtml('<iframe src="https://evil.example.com/x"></iframe><iframe src="javascript:alert(1)"></iframe>');
    expect(bad).not.toContain("evil");
    expect(bad).not.toContain("javascript");
  });
});
