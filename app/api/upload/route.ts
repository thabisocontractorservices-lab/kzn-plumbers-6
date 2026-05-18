import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/upload
 *
 * Uploads a file to Supabase Storage and inserts the corresponding DB row.
 *
 * FormData fields:
 *   file          — the file blob
 *   type          — "photo" | "profile_photo" | "cert"
 *   plumber_id    — the plumber's UUID
 *   email         — fallback identifier (for registration before session exists)
 *   cert_name     — label for certifications (e.g. "PIRB Certificate")
 *   caption       — optional caption for photos
 *
 * Auth: either Bearer token or email lookup (registration flow).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // photo | profile_photo | cert
    const plumberId = formData.get("plumber_id") as string | null;
    const email = formData.get("email") as string | null;
    const certName = formData.get("cert_name") as string | null;
    const caption = formData.get("caption") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!type || !["photo", "profile_photo", "cert"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be photo, profile_photo, or cert" },
        { status: 400 },
      );
    }

    // ── Resolve plumber ID ────────────────────────────────────────────────
    let resolvedPlumberId = plumberId;

    if (!resolvedPlumberId && email) {
      // Registration flow — look up plumber by email → profile → plumber
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const user = usersData?.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (user) {
        const { data: p } = await supabaseAdmin
          .from("plumbers")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        resolvedPlumberId = p?.id ?? null;
      }
    }

    // Also try auth token if provided
    if (!resolvedPlumberId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          const { data: p } = await supabaseAdmin
            .from("plumbers")
            .select("id")
            .eq("profile_id", user.id)
            .maybeSingle();
          resolvedPlumberId = p?.id ?? null;
        }
      }
    }

    if (!resolvedPlumberId) {
      return NextResponse.json(
        { error: "Could not resolve plumber. Provide plumber_id or valid email/token." },
        { status: 400 },
      );
    }

    // ── Determine bucket and path ─────────────────────────────────────────
    const bucket = type === "cert" ? "certs" : "photos";
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const timestamp = Date.now();
    const safeName = `${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = `${resolvedPlumberId}/${safeName}`;

    // ── Upload to Supabase Storage ────────────────────────────────────────
    const arrayBuf = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, arrayBuf, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // ── Build the public/signed URL ───────────────────────────────────────
    let fileUrl: string;
    if (bucket === "photos") {
      // photos bucket is public
      const { data: urlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(storagePath);
      fileUrl = urlData.publicUrl;
    } else {
      // certs bucket is private — use a long-lived signed URL (1 year)
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      if (signedError || !signedData?.signedUrl) {
        console.error("Signed URL error:", signedError);
        fileUrl = storagePath; // fallback
      } else {
        fileUrl = signedData.signedUrl;
      }
    }

    // ── Insert DB row ─────────────────────────────────────────────────────
    if (type === "cert") {
      const { error: dbError } = await supabaseAdmin
        .from("certifications")
        .insert({
          plumber_id: resolvedPlumberId,
          cert_name: certName || file.name.replace(/\.[^.]+$/, ""),
          cert_file_url: fileUrl,
        });

      if (dbError) {
        console.error("Cert DB insert error:", dbError);
        return NextResponse.json(
          { error: `File uploaded but DB insert failed: ${dbError.message}` },
          { status: 500 },
        );
      }
    } else {
      // photo or profile_photo
      const isProfile = type === "profile_photo";

      // If setting profile photo, unset any existing one first
      if (isProfile) {
        await supabaseAdmin
          .from("photos")
          .update({ is_profile_photo: false })
          .eq("plumber_id", resolvedPlumberId)
          .eq("is_profile_photo", true);
      }

      const { error: dbError } = await supabaseAdmin
        .from("photos")
        .insert({
          plumber_id: resolvedPlumberId,
          photo_url: fileUrl,
          is_profile_photo: isProfile,
          caption: caption || null,
        });

      if (dbError) {
        console.error("Photo DB insert error:", dbError);
        return NextResponse.json(
          { error: `File uploaded but DB insert failed: ${dbError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      type,
      plumber_id: resolvedPlumberId,
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/upload
 * Body: { type: "photo"|"cert", id: string, plumber_id: string }
 * Auth: Bearer token
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { type, id } = await req.json();

    // Verify ownership
    const { data: plumber } = await supabaseAdmin
      .from("plumbers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!plumber) {
      return NextResponse.json({ error: "No plumber profile found" }, { status: 403 });
    }

    if (type === "cert") {
      // Get the cert to find the storage path
      const { data: cert } = await supabaseAdmin
        .from("certifications")
        .select("id, cert_file_url")
        .eq("id", id)
        .eq("plumber_id", plumber.id)
        .single();

      if (!cert) {
        return NextResponse.json({ error: "Certification not found" }, { status: 404 });
      }

      // Delete from storage (extract path from URL)
      const path = extractStoragePath(cert.cert_file_url, "certs");
      if (path) {
        await supabaseAdmin.storage.from("certs").remove([path]);
      }

      await supabaseAdmin.from("certifications").delete().eq("id", id);
    } else {
      const { data: photo } = await supabaseAdmin
        .from("photos")
        .select("id, photo_url")
        .eq("id", id)
        .eq("plumber_id", plumber.id)
        .single();

      if (!photo) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }

      const path = extractStoragePath(photo.photo_url, "photos");
      if (path) {
        await supabaseAdmin.storage.from("photos").remove([path]);
      }

      await supabaseAdmin.from("photos").delete().eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Try to extract the storage path from a Supabase URL */
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    let idx = url.indexOf(marker);
    if (idx >= 0) return url.slice(idx + marker.length).split("?")[0];
    idx = url.indexOf(signedMarker);
    if (idx >= 0) return url.slice(idx + signedMarker.length).split("?")[0];
    return null;
  } catch {
    return null;
  }
}
