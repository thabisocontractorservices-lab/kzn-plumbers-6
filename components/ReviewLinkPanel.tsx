"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function ReviewLinkPanel({
  reviewUrl,
  plumberName,
}: {
  reviewUrl: string;
  plumberName: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="panel">
      <h3 className="font-display text-lg font-bold mb-1">Share Review Link</h3>
      <p className="text-xs text-gray-500 mb-4">
        Help this plumber by leaving a Google review
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
        <div className="bg-white border border-gray-200 rounded-lg p-2 shrink-0">
          <QRCodeSVG
            value={reviewUrl}
            size={100}
            fgColor="#1A5FBE"
            level="M"
          />
        </div>
        <div className="w-full space-y-2">
          <div className="text-xs text-gray-600 text-center sm:text-left">
            Scan to leave a Google review
          </div>
          <button onClick={copy} className="btn-secondary w-full text-sm">
            📋 {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hi! I'd appreciate if you could leave me a Google review here: ${reviewUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp w-full text-sm"
          >
            💬 Share via WhatsApp
          </a>
        </div>
      </div>
      <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] text-gray-600 break-all">
        {reviewUrl}
      </div>
    </div>
  );
}
