export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    if (character === "<") return "\\u003c";
    if (character === ">") return "\\u003e";
    if (character === "&") return "\\u0026";
    if (character === "\u2028") return "\\u2028";
    return "\\u2029";
  });
}

export function safeStoredJsonLd(value: string | Record<string, unknown>): string {
  if (typeof value !== "string") return safeJsonLd(value);
  try {
    return safeJsonLd(JSON.parse(value));
  } catch {
    return "{}";
  }
}
