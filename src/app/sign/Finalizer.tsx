"use client";

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { useUpload } from "@/context/UploadContext";
import { track } from "@/lib/track";
import { useState } from "react";
import LoadingSpinnerSmall from "@/components/LoadingSpinner";

// Constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for processing

type TextElement = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
};

type ViewportSize = { width: number; height: number };

export default function Finalizer({
  sigDataUrl,
  page = 1,
  x = 20,
  y = 20,
  width = 200,
  height: signatureHeight = 80,
  rotation = 0,
  textElements = [],
  pdfViewportSize,
}: {
  sigDataUrl: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  textElements?: TextElement[];
  pdfViewportSize?: ViewportSize | null;
}) {
  const { file } = useUpload();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    if (!file) {
      setError("Missing file");
      return;
    }

    if (!sigDataUrl && textElements.length === 0) {
      setError("Add a signature or text before downloading");
      return;
    }

    // Check file size for processing
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large to process. Please use a smaller PDF.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Enforce usage limit for authenticated Free users
      try {
        const resp = await fetch("/api/usage", { method: "POST" });
        if (resp.status === 402) {
          setError("Free limit reached (3/month). Please upgrade to Pro.");
          return;
        }
        if (!resp.ok) {
          console.warn("Usage tracking failed:", resp.status);
        }
      } catch (usageError) {
        console.warn("Usage tracking error:", usageError);
        // Continue with download even if usage tracking fails
      }

      // Process PDF
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const getPageScales = (targetPageIndex: number) => {
        const target = pages[targetPageIndex]!;
        const targetSize = target.getSize();
        const scaleX = pdfViewportSize ? targetSize.width / pdfViewportSize.width : 1;
        const scaleY = pdfViewportSize ? targetSize.height / pdfViewportSize.height : 1;
        return { target, targetSize, scaleX, scaleY };
      };

      textElements.forEach((item) => {
        if (!item.text.trim()) return;
        const targetPageIndex = Math.max(0, Math.min(item.page - 1, pages.length - 1));
        const { target, targetSize, scaleX, scaleY } = getPageScales(targetPageIndex);
        target.drawText(item.text.trim(), {
          x: item.x * scaleX,
          y: targetSize.height - (item.y + item.height) * scaleY + 8 * scaleY,
          size: item.fontSize * scaleY,
          font,
          color: rgb(0, 0, 0),
          maxWidth: item.width * scaleX,
        });
      });

      if (sigDataUrl) {
        // Embed signature image
        const pngBytes = await fetch(sigDataUrl).then((r) => {
          if (!r.ok) throw new Error("Failed to fetch signature image");
          return r.arrayBuffer();
        });

        const png = await pdfDoc.embedPng(pngBytes);
        const targetPageIndex = Math.max(0, Math.min(page - 1, pages.length - 1));
        const { target, targetSize, scaleX, scaleY } = getPageScales(targetPageIndex);
        const drawnWidth = width * scaleX;
        const drawnHeight = signatureHeight * scaleY;
        const centerX = (x + width / 2) * scaleX;
        const centerY = targetSize.height - (y + signatureHeight / 2) * scaleY;

        target.drawImage(png, {
          x: centerX - drawnWidth / 2,
          y: centerY - drawnHeight / 2,
          width: drawnWidth,
          height: drawnHeight,
          rotate: degrees(rotation),
        });
      }

      const out = await pdfDoc.save();
      const abCopy = new ArrayBuffer(out.byteLength);
      new Uint8Array(abCopy).set(out);
      const blob = new Blob([abCopy], { type: "application/pdf" });

      // Try to store for logged-in users
      try {
        const form = new FormData();
        form.append("file", blob, `completed-${file.name}`);
        form.append("filename", `completed-${file.name}`);
        const resp = await fetch("/api/documents/create", { method: "POST", body: form });
        if (!resp.ok) {
          console.warn("Document storage failed:", resp.status);
          // Continue with download even if storage fails
        }
      } catch (storageError) {
        console.warn("Document storage error:", storageError);
        // Continue with download even if storage fails
      }

      // Always allow download
      track("finalize_download");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `completed-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);

      // Show success message
      setError(null);
    } catch (err) {
      console.error("PDF processing error:", err);
      const message = err instanceof Error ? err.message : "Failed to process PDF";
      setError(`Error: ${message}. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  }

  const canDownload = Boolean(sigDataUrl) || textElements.length > 0;

  return (
    <div className="space-y-3">
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={onDownload}
        disabled={!canDownload || isProcessing}
        className="w-full rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        aria-label="Download completed PDF"
      >
        {isProcessing ? "Processing..." : "Download Completed PDF"}
      </button>

      {/* Processing Info */}
      {isProcessing && (
        <div className="text-center text-sm text-foreground/70">
          <LoadingSpinnerSmall text="Processing PDF..." />
        </div>
      )}

      {/* Requirements */}
      {!canDownload && (
        <div className="text-xs text-foreground/60 text-center">
          Add a signature or text to enable download
        </div>
      )}
    </div>
  );
}
