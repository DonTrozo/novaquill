"use client";

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { useUpload } from "@/context/UploadContext";
import { track } from "@/lib/track";
import { useEffect, useMemo, useState } from "react";
import LoadingSpinnerSmall from "@/components/LoadingSpinner";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

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

type PreviewState = {
  blob: Blob;
  url: string;
  filename: string;
  version: string;
} | null;

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
  pdfViewportSizes = {},
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
  pdfViewportSizes?: Record<number, ViewportSize>;
}) {
  const { file } = useUpload();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);

  const hasDrawableText = textElements.some((item) => item.text.trim().length > 0);
  const canFinalize = Boolean(sigDataUrl) || hasDrawableText;

  const currentVersion = useMemo(
    () =>
      JSON.stringify({
        fileName: file?.name,
        fileSize: file?.size,
        fileLastModified: file?.lastModified,
        sigDataUrl,
        page,
        x,
        y,
        width,
        signatureHeight,
        rotation,
        textElements,
        pdfViewportSize,
        pdfViewportSizes,
      }),
    [file, sigDataUrl, page, x, y, width, signatureHeight, rotation, textElements, pdfViewportSize, pdfViewportSizes]
  );

  const isPreviewCurrent = Boolean(preview && preview.version === currentVersion);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  function clearPreview() {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function validateInput() {
    if (!file) return "Missing file";
    if (!canFinalize) return "Add a signature, text, date, initials, or checkbox before previewing.";
    if (file.size > MAX_FILE_SIZE) return "File is too large to process. Please use a smaller PDF.";
    return null;
  }

  async function buildFinalPdfBlob() {
    if (!file) throw new Error("Missing file");

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const getPageScales = (targetPageIndex: number) => {
      const target = pages[targetPageIndex]!;
      const targetSize = target.getSize();
      const pageNumber = targetPageIndex + 1;
      const viewportSize = pdfViewportSizes[pageNumber] || (pageNumber === page ? pdfViewportSize : null);
      const scaleX = viewportSize ? targetSize.width / viewportSize.width : 1;
      const scaleY = viewportSize ? targetSize.height / viewportSize.height : 1;
      return { target, targetSize, scaleX, scaleY };
    };

    textElements.forEach((item) => {
      const text = item.text.trim();
      if (!text) return;
      const targetPageIndex = Math.max(0, Math.min(item.page - 1, pages.length - 1));
      const { target, targetSize, scaleX, scaleY } = getPageScales(targetPageIndex);
      target.drawText(text, {
        x: item.x * scaleX,
        y: targetSize.height - (item.y + item.height) * scaleY + 8 * scaleY,
        size: item.fontSize * scaleY,
        font,
        color: rgb(0, 0, 0),
        maxWidth: item.width * scaleX,
      });
    });

    if (sigDataUrl) {
      const pngBytes = await fetch(sigDataUrl).then((response) => {
        if (!response.ok) throw new Error("Failed to fetch signature image");
        return response.arrayBuffer();
      });

      const png = await pdfDoc.embedPng(pngBytes);
      const targetPageIndex = Math.max(0, Math.min(page - 1, pages.length - 1));
      const { target, targetSize, scaleX, scaleY } = getPageScales(targetPageIndex);
      const drawnWidth = width * scaleX;
      const drawnHeight = signatureHeight * scaleY;
      const centerX = (x + width / 2) * scaleX;
      const centerY = targetSize.height - (y + signatureHeight / 2) * scaleY;
      const radians = (rotation * Math.PI) / 180;
      const offsetX = (drawnWidth / 2) * Math.cos(radians) - (drawnHeight / 2) * Math.sin(radians);
      const offsetY = (drawnWidth / 2) * Math.sin(radians) + (drawnHeight / 2) * Math.cos(radians);

      target.drawImage(png, {
        x: centerX - offsetX,
        y: centerY - offsetY,
        width: drawnWidth,
        height: drawnHeight,
        rotate: degrees(rotation),
      });
    }

    try {
      pdfDoc.getForm().flatten();
    } catch {
      // Ignore PDFs without AcroForm fields.
    }

    const out = await pdfDoc.save();
    const abCopy = new ArrayBuffer(out.byteLength);
    new Uint8Array(abCopy).set(out);
    return new Blob([abCopy], { type: "application/pdf" });
  }

  async function onPreview() {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blob = await buildFinalPdfBlob();
      const filename = `completed-${file!.name}`;
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { blob, url, filename, version: currentVersion };
      });
      track("finalize_preview");
    } catch (err) {
      console.error("PDF preview error:", err);
      const message = err instanceof Error ? err.message : "Failed to generate preview";
      setError(`Error: ${message}. Please adjust the document and try again.`);
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function onConfirmDownload() {
    if (!preview || !isPreviewCurrent) {
      setError("Finish and check the latest preview before downloading.");
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const usageResponse = await fetch("/api/usage", { method: "POST" });
      if (usageResponse.status === 402) {
        setError("Free limit reached (3/month). Please upgrade to Pro.");
        return;
      }
      if (usageResponse.status === 401) {
        setError("Please sign in again before downloading.");
        return;
      }
      if (!usageResponse.ok) {
        setError("Could not confirm your document credit. Please try again.");
        return;
      }

      try {
        const form = new FormData();
        form.append("file", preview.blob, preview.filename);
        form.append("filename", preview.filename);
        const storageResponse = await fetch("/api/documents/create", { method: "POST", body: form });
        if (!storageResponse.ok) console.warn("Document storage failed:", storageResponse.status);
      } catch (storageError) {
        console.warn("Document storage error:", storageError);
      }

      track("finalize_download");
      downloadBlob(preview.blob, preview.filename);
    } catch (err) {
      console.error("PDF confirmation error:", err);
      const message = err instanceof Error ? err.message : "Failed to confirm download";
      setError(`Error: ${message}. Please try again.`);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <button
        onClick={onPreview}
        disabled={!canFinalize || isProcessing || isConfirming}
        className="w-full rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Finish and preview signed PDF"
      >
        {isProcessing ? "Creating preview..." : isPreviewCurrent ? "Update Preview" : "Finish & Preview"}
      </button>

      {isProcessing && (
        <div className="text-center text-sm text-foreground/70">
          <LoadingSpinnerSmall text="Creating preview..." />
        </div>
      )}

      {preview && !isPreviewCurrent && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          The document changed after this preview was created. Update the preview before downloading.
        </div>
      )}

      {preview && isPreviewCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-background shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-foreground/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Review your signed PDF</h2>
                <p className="mt-1 text-sm text-foreground/70">
                  Check placement here first. Your credit is only used when you download the final PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={clearPreview}
                disabled={isConfirming}
                className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back to Edit
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <iframe
                title="Completed PDF preview"
                src={preview.url}
                className="h-[65vh] w-full rounded-md border border-foreground/10 bg-white"
              />
            </div>
            <div className="grid gap-2 border-t border-foreground/10 p-4 sm:flex sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={clearPreview}
                disabled={isConfirming}
                className="rounded-md border border-foreground/20 px-4 py-2 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={onConfirmDownload}
                disabled={isConfirming}
                className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirming ? "Preparing download..." : "Download Signed PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canFinalize && (
        <div className="text-center text-xs text-foreground/60">
          Add a signature, text, date, initials, or checkbox to preview the final PDF
        </div>
      )}
    </div>
  );
}
