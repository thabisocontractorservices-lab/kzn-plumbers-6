import sanitizeHtml from "sanitize-html";

export function sanitizeEditorialHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i",
      "a", "blockquote", "hr", "br", "table", "thead", "tbody", "tr", "th", "td",
      "figure", "figcaption", "img",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, loading: "lazy" },
      }),
    },
  });
}
