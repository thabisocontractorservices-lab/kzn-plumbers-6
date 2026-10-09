import sanitizeHtml from "sanitize-html";

export function sanitizeEditorialHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i",
      "a", "blockquote", "hr", "br", "table", "thead", "tbody", "tr", "th", "td",
      "figure", "figcaption", "img", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      figure: ["class"],
      iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "referrerpolicy", "loading"],
    },
    allowedClasses: { figure: ["video-embed"] },
    // Video embeds: YouTube only. Any other iframe source is stripped.
    allowedIframeHostnames: ["www.youtube-nocookie.com", "www.youtube.com"],
    allowIframeRelativeUrls: false,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
      iframe: (_tagName, attribs) => ({
        tagName: "iframe",
        attribs: /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[\w-]{6,20}(\?[\w=&;-]*)?$/.test(attribs.src || "")
          ? { ...attribs, loading: "lazy", referrerpolicy: "strict-origin-when-cross-origin" }
          : {},
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, loading: "lazy" },
      }),
    },
  });
}
