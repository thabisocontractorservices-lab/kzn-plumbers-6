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
  cert_file_url: string;
  uploaded_at: string;
};

export default function UploadsPage() {
  const { user, authChecking } = useAuthGate();
  const [plumberId, setPlumberId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: session } = await supabase.auth.getSession();
    setAccessToken(session.session?.access_token || "");

    const { data: plumber } = await supabase
      .from("plumbers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!plumber) {
      setLoading(false);
      return;
    }

    setPlumberId(plumber.id);

    const [photosRes, certsRes] = await Promise.all([
      supabase
        .from("photos")
        .select("*")
        .eq("plumber_id", plumber.id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("certifications")
        .select("*")
        .eq("plumber_id", plumber.id)
        .order("uploaded_at", { ascending: false }),
    ]);

    setPhotos((photosRes.data as Photo[]) ?? []);
    setCerts((certsRes.data as Cert[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (authChecking || loading) return <DashboardLoading />;
  if (!user) return null;

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
  const workPhotos = photos.filter((p) => !p.is_profile_photo);

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
              accept="image/*"
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
              accessToken={accessToken}
            />
          </div>

          {/* Certifications */}
          <div className="panel">
            <h2 className="font-display text-xl mb-4">Certifications</h2>
            <p className="text-xs text-gray-500 mb-4">
              PIRB, SESSA, LPGSA certificates. PDF or images accepted.
            </p>
            <FileUploader
              plumberId={plumberId}
              type="cert"
              label="Upload certifications"
              icon="📜"
              accept="image/*,.pdf"
              multiple
              maxFiles={10}
              hint="PDF or images, max 10MB each"
              existingFiles={certs.map((c) => ({
                id: c.id,
                url: c.cert_file_url,
                name: c.cert_name,
              }))}
              onUploadComplete={fetchData}
              accessToken={accessToken}
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
            accept="image/*"
            multiple
            maxFiles={10}
            hint="Up to 10 images of completed jobs, max 10MB each"
            existingFiles={workPhotos.map((p) => ({
              id: p.id,
              url: p.photo_url,
              name: p.caption || "Work photo",
            }))}
            onUploadComplete={fetchData}
            accessToken={accessToken}
          />
        </div>
      </div>
    </div>
  );
}

