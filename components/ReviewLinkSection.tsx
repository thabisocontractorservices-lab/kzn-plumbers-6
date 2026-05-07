"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export function ReviewLinkSection({
  reviewUrl,
  shortUrl,
  plumberName,
}: {
  reviewUrl: string;
  shortUrl: string;
  plumberName: string;
}) {
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function download() {
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${plumberName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-review-qr.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="panel bg-gradient-to-br from-brand-light to-white">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">🔗</span>
        <h2 className="font-display text-xl font-bold">
          Your shareable Google review link
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Send this to happy customers — every review boosts your visibility on Google and our directory.
      </p>

      <div className="grid md:grid-cols-[180px_1fr] gap-5 items-start">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <QRCodeCanvas
            ref={qrRef as React.RefObject<HTMLCanvasElement>}
            value={reviewUrl}
            size={156}
            fgColor="#1A5FBE"
            level="M"
          />
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Long URL
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg">
              <span className="font-mono text-xs truncate flex-1 text-gray-600">
                {reviewUrl}
              </span>
              <button
                onClick={() => copy(reviewUrl, "long")}
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
              >
                {copied === "long" ? "✓" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Branded short link
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg">
              <span className="font-mono text-xs truncate flex-1 text-brand font-semibold">
                {shortUrl}
              </span>
              <button
                onClick={() => copy(shortUrl, "short")}
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
              >
                {copied === "short" ? "✓" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hi! I'd appreciate if you could leave me a review here: ${reviewUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              💬 Send via WhatsApp
            </a>
            <button onClick={download} className="btn-secondary">
              ⬇ Download QR (PNG)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
