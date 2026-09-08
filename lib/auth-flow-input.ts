import "server-only";
import { AccessError, accessFailure, isMissingSchema } from "@/lib/server-access";

/** An unexpected write/transport failure does not prove that nothing was committed. */
export function authFlowFailure(error: unknown) {
  if (error instanceof AccessError) return accessFailure(error);
  console.error("[auth-flow] Request outcome could not be confirmed");
  return accessFailure(new AccessError("This action could not be confirmed. Check the current state before retrying.", 503));
}

/** Do not trust Content-Length alone: streamed/chunked requests have the same limit. */
async function readAuthFlowBytes(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) {
    throw new AccessError("Request is too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError("Invalid request.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AccessError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readAuthFlowJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!(request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase().endsWith("/json")) throw new AccessError("Send a JSON request.", 415);
  const bytes = await readAuthFlowBytes(request, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AccessError("Invalid JSON request.", 400); }
}

export async function readAuthFlowFormData(request: Request, maxBytes: number): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new AccessError("Send a file upload form.", 415);
  const bytes = await readAuthFlowBytes(request, maxBytes);
  try { return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new AccessError("Invalid upload form.", 400); }
}

/** Only retry a known optional column, never a permission/network/constraint error. */
export function missingAuthFlowColumn(
  error: { code?: string; message?: string } | null | undefined,
  table: string,
  columns: readonly string[],
): string | null {
  if (!isMissingSchema(error) || !["42703", "PGRST204"].includes(error?.code || "")) return null;
  const message = error?.message || "";
  for (const column of columns) {
    if (message.includes(`Could not find the '${column}' column of '${table}'`)
      || message.includes(`column ${table}.${column} does not exist`)
      || message.includes(`column "${column}" of relation "${table}" does not exist`)
      || message.includes(`column "${column}" does not exist`)) return column;
  }
  return null;
}
