"use client";

import { documentVersion } from "@/lib/documentVersion";
import type { InkStroke } from "@/lib/documentInk";
import { buildSignedPdf } from "@/lib/buildSignedPdf";
import { PdfDocumentPreview } from "@/components/PdfViewer";
import { useUpload } from "@/context/UploadContext";
import { track } from "@/lib/track";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LoadingSpinnerSmall from "@/components/LoadingSpinner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { clearSigningDraft } from "@/lib/signingDraft";

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
  creditKey: string;
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
  inkStrokes = [],
  drawing = false,
  pdfViewportSize,
  pdfViewportSizes = {},
  onBeforeSignIn,
  resumePreview = false,
}: {
  sigDataUrl: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  textElements?: TextElement[];
  inkStrokes?: InkStroke[];
  drawing?: boolean;
  pdfViewportSize?: ViewportSize | null;
  pdfViewportSizes?: Record<number, ViewportSize>;
  onBeforeSignIn: () => Promise<void>;
  resumePreview?: boolean;
}) {
  const { file } = useUpload();
  const { status } = useSession();
  const router = useRouter();
  const resumed = useRef(false);
  const previewAction = useRef<() => Promise<void>>(async () => {});
  const downloadInProgress = useRef(false);
  const chargedVersions = useRef(new Set<string>());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);

  const hasDrawableText = textElements.some((item) => item.text.trim().length > 0);
  const canFinalize = Boolean(sigDataUrl) || hasDrawableText || inkStrokes.length > 0;

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
        inkStrokes,
        pdfViewportSize,
        pdfViewportSizes,
      }),
    [file, sigDataUrl, page, x, y, width, signatureHeight, rotation, textElements, inkStrokes, pdfViewportSize, pdfViewportSizes]
  );

  const creditKey = documentVersion({
    fileName: file?.name, fileSize: file?.size, fileLastModified: file?.lastModified,
    sigDataUrl, page, x, y, width, height: signatureHeight, rotation,
    textElements, inkStrokes, viewportSizes: pdfViewportSizes,
  });

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
    const out = await buildSignedPdf({
      pdfBytes: new Uint8Array(await file.arrayBuffer()),
      sigDataUrl, page, x, y, width, signatureHeight, rotation,
      textElements, inkStrokes, pdfViewportSize, pdfViewportSizes,
    });
    const copy = new ArrayBuffer(out.byteLength);
    new Uint8Array(copy).set(out);
    return new Blob([copy], { type: "application/pdf" });
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
        return { blob, url, filename, version: currentVersion, creditKey };
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
  previewAction.current = onPreview;
  useEffect(() => {
    if (!resumePreview || resumed.current || drawing || !canFinalize || !file) return;
    resumed.current = true;
    void previewAction.current();
  }, [resumePreview, drawing, canFinalize, file]);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function onConfirmDownload() {
    if (!preview || !isPreviewCurrent) {
      setError("Finish and check the latest preview before downloading.");
      return;
    }

    if (downloadInProgress.current) return;
    downloadInProgress.current = true;
    setIsConfirming(true);
    setError(null);

    try {
      if (status !== "authenticated") {
        await onBeforeSignIn();
        router.push("/login?next=/sign");
        return;
      }
      // Previews and repeat downloads of the same completed version do not
      // spend another credit. Check the server before releasing a new output.
      if (!chargedVersions.current.has(preview.creditKey)) {
        const response = await fetch("/api/usage", { method: "POST" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = response.status === 401 ? "Please sign in again before downloading." : payload.error || "Could not confirm your document allowance. Please try again.";
          setError(message);
          return;
        }
        chargedVersions.current.add(preview.creditKey);
        window.dispatchEvent(new Event("novaquill:usage-changed"));
      }
      downloadBlob(preview.blob, preview.filename);
      void clearSigningDraft().catch(() => {});
      const form = new FormData();
      form.append("file", preview.blob, preview.filename);
      form.append("filename", preview.filename);
      void fetch("/api/documents/create", { method: "POST", body: form })
        .then((response) => {
          if (response.status === 402) return; // Cloud storage is a Pro feature.
          if (!response.ok) setError("Your PDF was downloaded, but could not be saved to your cloud account.");
        })
        .catch(() => setError("Your PDF was downloaded, but cloud storage is unavailable."));

      track("finalize_download");
    } catch (err) {
      console.error("PDF confirmation error:", err);
      const message = err instanceof Error ? err.message : "Failed to confirm download";
      setError(`Error: ${message}. Please try again.`);
    } finally {
      downloadInProgress.current = false;
      setIsConfirming(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <span>⚠️</span>
            <span>{error} {error.includes("Upgrade to Pro") && <a href="/pricing" className="underline font-medium">View Pro plans</a>}</span>
          </div>
        </div>
      )}

      <button
        onClick={onPreview}
        disabled={!canFinalize || drawing || isProcessing || isConfirming}
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

      {preview && isPreviewCurrent && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-background shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-foreground/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Review your signed PDF</h2>
                <p className="mt-1 text-sm text-foreground/70">
                  Check every page before downloading. A free document credit is used only on the first download of this completed version. Pro has unlimited signing.
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
              <PdfDocumentPreview blob={preview.blob} />
            </div>
            <div className="grid gap-2 border-t border-foreground/10 p-4 sm:flex sm:items-center sm:justify-end">
              {error && <p role="alert" className="text-sm text-red-600 sm:mr-auto">{error} {error.includes("Upgrade to Pro") && <a href="/pricing" className="underline">View Pro plans</a>}</p>}
              <button
                type="button"
                onClick={clearPreview}
                disabled={isConfirming || status === "loading"}
                className="rounded-md border border-foreground/20 px-4 py-2 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={onConfirmDownload}
                disabled={isConfirming || status === "loading"}
                className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirming ? "Preparing download..." : status === "loading" ? "Checking sign-in…" : status === "authenticated" ? "Download Signed PDF" : "Sign in & Download"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {!canFinalize && (
        <div className="text-center text-xs text-foreground/60">
          Add a signature, text, date, initials, or checkbox to preview the final PDF
        </div>
      )}
    </div>
  );
}
