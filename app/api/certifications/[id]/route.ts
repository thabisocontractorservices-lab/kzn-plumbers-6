import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, accessFailure, requireUser } from "@/lib/server-access";
import { authFlowStoragePath, requireAuthFlowFileManager } from "@/lib/auth-flow-storage";

export const dynamic = "force-dynamic";
const DOWNLOAD_SECONDS = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new AccessError("Invalid certificate id.", 400);
    const admin = getSupabaseAdmin();
    const result = await admin.from("certifications").select("id, plumber_id, cert_file_url").eq("id", id).maybeSingle();
    if (result.error) throw new AccessError("Certificate downloads are temporarily unavailable.", 503);
    if (!result.data) throw new AccessError("Certificate not found.", 404);
    await requireAuthFlowFileManager(request, result.data.plumber_id);
    const path = authFlowStoragePath(result.data.cert_file_url, "certs", result.data.plumber_id);
    if (!path) throw new AccessError("This legacy certificate path needs administrator attention.", 422);
    const bucket = await admin.storage.getBucket("certs");
    if (bucket.error || bucket.data?.public !== false) throw new AccessError("Private certificate storage could not be verified. Download refused.", 503);
    const extension = path.match(/\.(pdf|jpe?g|png|webp)$/i)?.[1].toLowerCase() || "bin";
    const signed = await admin.storage.from("certs").createSignedUrl(path, DOWNLOAD_SECONDS, { download: `certificate-${id}.${extension}` });
    if (signed.error || !signed.data?.signedUrl) throw new AccessError("The download link could not be created.", 503);
    // Check even the generated URL before redirecting; never use the legacy stored URL.
    const url = new URL(signed.data.signedUrl);
    if (!url.pathname.startsWith("/storage/v1/object/sign/certs/") || authFlowStoragePath(url.toString(), "certs", result.data.plumber_id) !== path) {
      throw new AccessError("The download URL could not be verified.", 503);
    }
    const response = NextResponse.redirect(url, { status: 303 });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vary", "Cookie, Authorization");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  } catch (error) { return accessFailure(error); }
}
