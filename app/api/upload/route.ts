import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, privateJson, requireSameOrigin, requireUser } from "@/lib/server-access";
import { authFlowFailure as accessFailure, readAuthFlowFormData, readAuthFlowJson } from "@/lib/auth-flow-input";
import { authFlowStoragePath, requireAuthFlowFileManager } from "@/lib/auth-flow-storage";

const IdSchema = z.string().uuid();
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CERT_TYPES = new Set([...PHOTO_TYPES, "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireUser(request);
    const formData = await readAuthFlowFormData(request, MAX_BYTES + 65536);
    const file = formData.get("file");
    const type = String(formData.get("type") || "");
    const plumberId = String(formData.get("plumber_id") || "");
    const certName = String(formData.get("cert_name") || "").trim().slice(0, 120);
    const caption = String(formData.get("caption") || "").trim().slice(0, 300);
    if (!(file instanceof File)) return privateJson({ error: "No file provided." }, 400);
    if (!IdSchema.safeParse(plumberId).success) return privateJson({ error: "Invalid plumber id." }, 400);
    if (!["photo", "profile_photo", "cert"].includes(type)) return privateJson({ error: "Invalid upload type." }, 400);
    if (file.size <= 0 || file.size > MAX_BYTES) return privateJson({ error: "Files must be smaller than 10 MB." }, 400);
    if (!(type === "cert" ? CERT_TYPES : PHOTO_TYPES).has(file.type)) return privateJson({ error: "Use JPEG, PNG, WebP, or PDF certificates." }, 400);
    // Unverified signup upload tokens no longer bypass owner/admin authentication.
    const { admin } = await requireAuthFlowFileManager(request, plumberId);
    const bucket = type === "cert" ? "certs" : "photos";
    if (bucket === "certs") {
      const state = await admin.storage.getBucket("certs");
      if (state.error || state.data?.public !== false) throw new AccessError("Private certificate storage could not be verified. Upload refused.", 503);
    }
    const storagePath = `${plumberId}/${Date.now()}_${randomUUID()}.${extensionFor(file.type)}`;
    const bytes = await file.arrayBuffer();
    if (!matchesFileSignature(bytes, file.type)) return privateJson({ error: "File contents do not match the declared type." }, 400);
    const uploaded = await admin.storage.from(bucket).upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new AccessError("File upload could not be confirmed. Check your uploads before retrying.", 503);

    const publicUrl = bucket === "photos" ? admin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl : null;
    const id = randomUUID();
    const result = type === "cert"
      ? await admin.from("certifications").insert({ id, plumber_id: plumberId, cert_name: certName || file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Certificate", cert_file_url: storagePath }).select("id").single()
      : await admin.from("photos").insert({ id, plumber_id: plumberId, photo_url: publicUrl, is_profile_photo: type === "profile_photo", caption: caption || null }).select("id").single();
    if (result.error || !result.data) {
      // Only clean up after a definite DB rejection. A transport timeout can follow
      // a successful commit; deleting bytes in that case would break the attachment.
      const definiteRejection = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(result.error?.code || "");
      if (definiteRejection) {
        const cleanup = await admin.storage.from(bucket).remove([storagePath]);
        if (cleanup.error) return privateJson({ error: "File attachment failed and its stored bytes could not be removed. Contact support before retrying." }, 503);
      }
      throw new AccessError("File attachment could not be confirmed. Check your uploads before retrying.", 503);
    }
    let warning: string | undefined;
    if (type === "profile_photo") {
      // Attach the new photo before changing existing ones. Never remove the old
      // profile selection when the new attachment failed. This is not a transaction.
      const selection = await admin.from("photos").update({ is_profile_photo: false }).eq("plumber_id", plumberId).neq("id", id).eq("is_profile_photo", true);
      if (selection.error) warning = "Photo saved, but the previous profile-photo selection could not be cleared. Check your uploads.";
    }
    return privateJson({ success: true, id, url: type === "cert" ? `/api/certifications/${id}` : publicUrl, type, plumber_id: plumberId, ...(warning ? { warning } : {}) }, 201);
  } catch (error) { return accessFailure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await requireUser(request);
    const parsed = z.object({ type: z.enum(["cert", "photo"]), id: IdSchema }).safeParse(await readAuthFlowJson(request, 4096));
    if (!parsed.success) return privateJson({ error: "Invalid file deletion request." }, 400);
    const { type, id } = parsed.data;
    const admin = getSupabaseAdmin();
    const table = type === "cert" ? "certifications" : "photos";
    const urlColumn = type === "cert" ? "cert_file_url" : "photo_url";
    const record = await admin.from(table).select(`id, plumber_id, ${urlColumn}`).eq("id", id).maybeSingle();
    if (record.error) throw new AccessError("Cannot check this file right now.", 503);
    if (!record.data) return privateJson({ error: "File record not found. Refresh your uploads." }, 404);
    await requireAuthFlowFileManager(request, record.data.plumber_id);
    const bucket = type === "cert" ? "certs" : "photos";
    const path = authFlowStoragePath(String((record.data as Record<string, unknown>)[urlColumn] || ""), bucket, record.data.plumber_id);
    if (!path) return privateJson({ error: "This legacy file path needs administrator attention. Nothing was deleted." }, 422);
    const removed = await admin.storage.from(bucket).remove([path]);
    if (removed.error) throw new AccessError("Stored file could not be removed. The file record has been kept.", 503);
    const deleted = await admin.from(table).delete().eq("id", id).eq("plumber_id", record.data.plumber_id).select("id");
    if (deleted.error) return privateJson({ error: "File bytes were removed, but its record could not be removed. Refresh and retry or contact support." }, 503);
    return privateJson({ success: true });
  } catch (error) { return accessFailure(error); }
}

function matchesFileSignature(buffer: ArrayBuffer, mime: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mime === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (mime === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  return false;
}

function extensionFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "pdf";
}
