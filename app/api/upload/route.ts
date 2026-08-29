import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyUploadToken } from "@/lib/upload-token";
import { SITE_URL } from "@/lib/site";

const IdSchema = z.string().uuid();
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CERT_TYPES = new Set([...PHOTO_TYPES, "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (!validOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    const formData = await request.formData();
    const file = formData.get("file");
    const type = String(formData.get("type") || "");
    const plumberId = String(formData.get("plumber_id") || "");
    const uploadToken = String(formData.get("upload_token") || "");
    const certName = String(formData.get("cert_name") || "").trim().slice(0, 120);
    const caption = String(formData.get("caption") || "").trim().slice(0, 300);

    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!IdSchema.safeParse(plumberId).success) return NextResponse.json({ error: "Invalid plumber id" }, { status: 400 });
    if (!["photo", "profile_photo", "cert"].includes(type)) return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be smaller than 10 MB" }, { status: 400 });
    const allowedTypes = type === "cert" ? CERT_TYPES : PHOTO_TYPES;
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const bearerAuthorised = await bearerCanManage(request, plumberId);
    const tokenAuthorised = uploadToken ? verifyUploadToken(uploadToken, plumberId) : false;
    if (!bearerAuthorised && !tokenAuthorised) return NextResponse.json({ error: "Unauthorized upload" }, { status: 403 });

    const bucket = type === "cert" ? "certs" : "photos";
    const extension = extensionFor(file.type);
    const storagePath = `${plumberId}/${Date.now()}_${randomUUID()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    if (!matchesFileSignature(arrayBuffer, file.type)) {
      return NextResponse.json({ error: "File contents do not match the declared type" }, { status: 400 });
    }
    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "File upload failed" }, { status: 503 });

    let publicUrl: string | null = null;
    if (bucket === "photos") publicUrl = admin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

    let dbError: { message: string } | null = null;
    if (type === "cert") {
      const result = await admin.from("certifications").insert({
        plumber_id: plumberId,
        cert_name: certName || file.name.replace(/\.[^.]+$/, "").slice(0, 120),
        cert_file_url: storagePath,
      });
      dbError = result.error;
    } else {
      const isProfile = type === "profile_photo";
      if (isProfile) {
        await admin.from("photos").update({ is_profile_photo: false }).eq("plumber_id", plumberId).eq("is_profile_photo", true);
      }
      const result = await admin.from("photos").insert({ plumber_id: plumberId, photo_url: publicUrl, is_profile_photo: isProfile, caption: caption || null });
      dbError = result.error;
    }

    if (dbError) {
      await admin.storage.from(bucket).remove([storagePath]);
      console.error("[upload] Database insert failed:", dbError.message);
      return NextResponse.json({ error: "Upload could not be attached to the profile" }, { status: 503 });
    }

    return NextResponse.json({ success: true, url: publicUrl, type, plumber_id: plumberId }, { status: 201 });
  } catch (error) {
    console.error("[upload] Unexpected error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    const body = await request.json();
    const type = body.type === "cert" ? "cert" : "photo";
    const id = String(body.id || "");
    if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid file id" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await admin.auth.getUser(authHeader.slice(7));
    if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const table = type === "cert" ? "certifications" : "photos";
    const urlColumn = type === "cert" ? "cert_file_url" : "photo_url";
    const { data: record } = await admin.from(table).select(`id, plumber_id, ${urlColumn}`).eq("id", id).maybeSingle();
    if (!record) return NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!(await userCanManage(user.id, record.plumber_id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const bucket = type === "cert" ? "certs" : "photos";
    const storedValue = String((record as Record<string, unknown>)[urlColumn] || "");
    const storagePath = extractStoragePath(storedValue, bucket) || (type === "cert" ? storedValue : null);
    if (storagePath) await admin.storage.from(bucket).remove([storagePath]);
    await admin.from(table).delete().eq("id", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[upload] Delete failed:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

function validOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || process.env.NODE_ENV !== "production") return true;
  const originHost = new URL(origin).host;
  const requestHost = request.headers.get("host");
  return originHost === requestHost || originHost === new URL(SITE_URL).host;
}

async function bearerCanManage(request: NextRequest, plumberId: string): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const admin = getSupabaseAdmin();
  const { data: { user } } = await admin.auth.getUser(header.slice(7));
  return user ? userCanManage(user.id, plumberId) : false;
}

async function userCanManage(userId: string, plumberId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const [{ data: plumber }, { data: profile }] = await Promise.all([
    admin.from("plumbers").select("profile_id").eq("id", plumberId).maybeSingle(),
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);
  return plumber?.profile_id === userId || profile?.role === "admin";
}

function matchesFileSignature(buffer: ArrayBuffer, mime: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
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

function extractStoragePath(value: string, bucket: string): string | null {
  for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`]) {
    const index = value.indexOf(marker);
    if (index >= 0) return value.slice(index + marker.length).split("?")[0];
  }
  return null;
}
