import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 15 * 60;

function secret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Upload token secret is unavailable");
  return value;
}

export function createUploadToken(plumberId: string): string {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${plumberId}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyUploadToken(token: string, plumberId: string): boolean {
  const [tokenPlumberId, expiresRaw, supplied] = token.split(".");
  if (!tokenPlumberId || !expiresRaw || !supplied || tokenPlumberId !== plumberId) return false;
  const expires = Number(expiresRaw);
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const payload = `${tokenPlumberId}.${expires}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}
