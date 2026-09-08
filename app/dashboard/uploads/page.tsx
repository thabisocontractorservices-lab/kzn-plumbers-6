"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { FileUploader } from "@/components/FileUploader";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";

type Photo = {
  id: string;
  photo_url: string;
  is_profile_photo: boolean;
  caption: string | null;
  uploaded_at: string;
};

type Cert = {
  id: string;
  cert_name: string;
  uploaded_at: string;
};

export default function UploadsPage() {
  const { user, authChecking } = useAuthGate();
  const [plumberId, setPlumberId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const verified = await supabase.auth.getUser();
      if (verified.error || verified.data.user?.id !== user.id || !verified.data.user.email_confirmed_at) {
        throw new Error("Confirm your email and sign in again to manage uploads.");
      }
      const result = await supabase.from("plumbers").select("id").eq("profile_id", user.id).maybeSingle();
      if (result.error) throw new Error("Your business profile could not be loaded. Please retry.");
      if (!result.data) { setPlumberId(null); setPhotos([]); setCerts([]); return; }
      const id = result.data.id;
      setPlumberId(id);
      const [photosRes, certsRes] = await Promise.all([
        supabase.from("photos").select("id, photo_url, is_profile_photo, caption, uploaded_at").eq("plumber_id", id).order("uploaded_at", { ascending: false }),
        // No raw certificate path or legacy signed URL is sent to FileUploader.
        supabase.from("certifications").select("id, cert_name, uploaded_at").eq("plumber_id", id).order("uploaded_at", { ascending: false }),
      ]);
      if (photosRes.error || certsRes.error) throw new Error("Some uploads could not be loaded. The list below may be incomplete; refresh before uploading or deleting files.");
      setPhotos((photosRes.data as Photo[]) ?? []);
      setCerts((certsRes.data as Cert[]) ?? []);
      // FileUploader owns its initial list; remount it with confirmed DB ids after
      // completion instead of retaining temporary URL-as-id entries.
      setRevision((value) => value + 1);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Uploads are temporarily unavailable."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;
  if (loadError) return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl">Uploads could not be verified</h1>
      <p role="alert" className="mt-3 text-sm text-red-800">{loadError}</p>
      <button type="button" className="btn-primary mt-4" onClick={() => { setLoading(true); void fetchData(); }}>Retry loading uploads</button>
      <Link href="/login?next=%2Fdashboard%2Fuploads" className="btn-secondary ml-2 mt-4">Sign in again</Link>
    </div>
  );

  if (!plumberId) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center">
        <h1 className="font-display text-3xl mb-3">No plumber profile yet</h1>
        <p className="text-gray-600 mb-6">Complete registration first.</p>
        <Link href="/register" className="btn-primary">
          Complete registration
        </Link>
      </div>
    );
  }

  const profilePhoto = photos.find((p) => p.is_profile_photo);
  const workPhotos = photos.filter((p) => p.id !== profilePhoto?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />

      <div>
        <header className="mb-8">
          <h1 className="font-display text-3xl">Photos & Certifications</h1>
          <p className="text-gray-500 text-sm">
            Upload photos and credentials to build trust with customers
          </p>
        </header>

        {photos.filter((photo) => photo.is_profile_photo).length > 1 && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">More than one photo is marked as primary. The newest is shown here; the other files remain listed below. Review the selection or contact support.</p>}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Profile Photo */}
          <div className="panel">
            <h2 className="font-display text-xl mb-4">Profile Photo</h2>
            <p className="text-xs text-gray-500 mb-4">
              This appears as your main photo on the directory listing.
            </p>
            <FileUploader
              plumberId={plumberId}
              type="profile_photo"
              label="Profile photo"
              icon="👤"
              accept="image/jpeg,image/png,image/webp"
              maxFiles={1}
              existingFiles={
                profilePhoto
                  ? [
                      {
                        id: profilePhoto.id,
                        url: profilePhoto.photo_url,
                        name: "Profile photo",
                        is_profile_photo: true,
                      },
                    ]
                  : []
              }
              onUploadComplete={fetchData}
              key={revision}
            />
          </div>

          {/* Certifications */}
          <div className="panel">
            <h2 className="font-display text-xl mb-4">Certifications</h2>
            <p className="text-xs text-gray-500 mb-4">
              PIRB, SESSA, LPGSA certificates. PDF, JPEG, PNG or WebP accepted. Downloads require your verified owner session or authorised admin access and expire after 60 seconds.
            </p>
            <FileUploader
              plumberId={plumberId}
              type="cert"
              label="Upload certifications"
              icon="📜"
              accept="image/jpeg,image/png,image/webp,.pdf"
              multiple
              maxFiles={10}
              hint="PDF or images, max 10MB each"
              existingFiles={certs.map((c) => ({
                id: c.id,
                url: `/api/certifications/${c.id}`,
                name: c.cert_name,
              }))}
              onUploadComplete={fetchData}
              key={revision}
            />
          </div>
        </div>

        {/* Work Photos */}
        <div className="panel mt-6">
          <h2 className="font-display text-xl mb-4">Work Photos</h2>
          <p className="text-xs text-gray-500 mb-4">
            Showcase your completed jobs. Customers love seeing real work.
          </p>
          <FileUploader
            plumberId={plumberId}
            type="photo"
            label="Upload work photos"
            icon="📸"
            accept="image/jpeg,image/png,image/webp"
            multiple
            maxFiles={10}
            hint="Up to 10 images of completed jobs, max 10MB each"
            existingFiles={workPhotos.map((p) => ({
              id: p.id,
              url: p.photo_url,
              name: p.caption || "Work photo",
            }))}
            onUploadComplete={fetchData}
            key={revision}
          />
        </div>
      </div>
    </div>
  );
}

