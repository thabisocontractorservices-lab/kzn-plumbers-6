"use client";

import { useState, useRef } from "react";

type UploadedFile = {
  id: string;
  url: string;
  name: string;
  is_profile_photo?: boolean;
};

type FileUploaderProps = {
  plumberId: string;
  type: "photo" | "profile_photo" | "cert";
  label: string;
  icon: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  hint?: string;
  existingFiles?: UploadedFile[];
  onUploadComplete?: () => void;
  accessToken?: string;
};

export function FileUploader({
  plumberId,
  type,
  label,
  icon,
  accept,
  multiple = false,
  maxFiles = 10,
  hint,
  existingFiles = [],
  onUploadComplete,
  accessToken,
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const toUpload = Array.from(selected).slice(0, maxFiles - files.length);
    if (toUpload.length === 0) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    // Validate file sizes (max 10MB each)
    for (const f of toUpload) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`${f.name} is too large. Maximum file size is 10MB.`);
        return;
      }
    }

    setError(null);
    setUploading(true);

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      setProgress(`Uploading ${i + 1} of ${toUpload.length}...`);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("plumber_id", plumberId);

      if (type === "cert") {
        formData.append(
          "cert_name",
          file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        );
      }

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers,
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setFiles((prev) => [
            ...prev,
            { id: data.url, url: data.url, name: file.name },
          ]);
        } else {
          setError(data.error || `Failed to upload ${file.name}`);
        }
      } catch {
        setError(`Network error uploading ${file.name}`);
      }
    }

    setUploading(false);
    setProgress(null);
    onUploadComplete?.();

    // Reset the input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(fileToDelete: UploadedFile) {
    if (!confirm("Delete this file?")) return;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          type: type === "profile_photo" ? "photo" : type,
          id: fileToDelete.id,
        }),
      });

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
        onUploadComplete?.();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Network error deleting file");
    }
  }

  const isImage = type !== "cert";
  const canAdd = files.length < maxFiles;

  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-2">{label}</div>

      {/* Existing / uploaded files */}
      {files.length > 0 && (
        <div
          className={
            isImage
              ? "grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3"
              : "flex flex-col gap-2 mb-3"
          }
        >
          {files.map((f) =>
            isImage ? (
              <div
                key={f.id}
                className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleDelete(f)}
                  className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Delete"
                >
                  ✕
                </button>
                {f.is_profile_photo && (
                  <div className="absolute bottom-0 left-0 right-0 bg-brand/80 text-white text-[10px] text-center py-1 font-semibold">
                    Profile photo
                  </div>
                )}
              </div>
            ) : (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <span className="text-xl">📄</span>
                <span className="flex-1 text-sm truncate">{f.name}</span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand text-xs font-semibold hover:underline"
                >
                  View
                </a>
                <button
                  onClick={() => handleDelete(f)}
                  className="text-red-500 text-xs font-semibold hover:underline"
                >
                  Delete
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/* Upload area */}
      {canAdd && (
        <label
          className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            uploading
              ? "border-brand bg-brand-light"
              : "border-gray-300 hover:border-brand hover:bg-brand-light"
          }`}
        >
          <div className="text-3xl text-gray-400 mb-2">{icon}</div>
          {uploading ? (
            <div className="text-sm text-brand font-semibold">{progress}</div>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                <strong className="text-brand">Click to upload</strong> or drag
                &amp; drop
              </div>
              {hint && (
                <div className="text-xs text-gray-500 mt-1">{hint}</div>
              )}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
