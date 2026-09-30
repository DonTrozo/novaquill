"use client";

import Link from "next/link";
import PdfViewer from "@/components/PdfViewer";
import SignatureTools from "@/components/SignatureTools";
import DocumentFillLayer, { type TextElement } from "@/components/DocumentFillLayer";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useUpload } from "@/context/UploadContext";
import Finalizer from "./Finalizer";

const INITIAL_SIGNATURE_POSITION = { x: 20, y: 20 };
const INITIAL_SIGNATURE_SIZE = { width: 200, height: 80 };
const INITIAL_SIGNATURE_ROTATION = 0;
const INITIAL_SCALE = 1.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.1;
const ROTATION_STEP = 15;

type PdfSize = { width: number; height: number };

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

export default function SignPage() {
  const { file } = useUpload();
  const { status } = useSession();
  const [pdfSize, setPdfSize] = useState<PdfSize | null>(null);
  const [pdfPageSizes, setPdfPageSizes] = useState<Record<number, PdfSize>>({});
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(INITIAL_SIGNATURE_POSITION);
  const [signatureSize, setSignatureSize] = useState(INITIAL_SIGNATURE_SIZE);
  const [signatureRotation, setSignatureRotation] = useState(INITIAL_SIGNATURE_ROTATION);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const isAuthLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  const handlePdfSize = (size: PdfSize) => {
    setPdfSize(size);
    setPdfPageSizes((current) => ({ ...current, [page]: size }));
  };

  const handleScaleChange = (direction: "increase" | "decrease") => {
    setScale((currentScale) => {
      if (direction === "increase") {
        return Math.min(MAX_SCALE, currentScale + SCALE_STEP);
      }
      return Math.max(MIN_SCALE, currentScale - SCALE_STEP);
    });
  };

  const handlePageChange = (direction: "next" | "prev") => {
    setPage((currentPage) => {
      if (direction === "next") {
        return Math.min(numPages, currentPage + 1);
      }
      return Math.max(1, currentPage - 1);
    });
  };

  const handleAddText = () => {
    if (!pdfSize) return;
    const width = Math.min(220, Math.max(80, pdfSize.width - 60));
    setTextElements((current) => [
      ...current,
      {
        id: `text-${Date.now()}`,
        page,
        x: 30,
        y: 30,
        width,
        height: 36,
        text: "",
        fontSize: 14,
      },
    ]);
  };

  const handleAddCheckmark = () => {
    if (!pdfSize) return;
    setTextElements((current) => [
      ...current,
      {
        id: `check-${Date.now()}`,
        page,
        x: 30,
        y: 30,
        width: 32,
        height: 32,
        text: "X",
        fontSize: 18,
      },
    ]);
  };

  const handleSignature = (dataUrl: string) => {
    setSigDataUrl(dataUrl);
    setPos(INITIAL_SIGNATURE_POSITION);
    setSignatureSize(INITIAL_SIGNATURE_SIZE);
    setSignatureRotation(INITIAL_SIGNATURE_ROTATION);
  };

  const clearSignature = () => {
    setSigDataUrl(null);
    setPos(INITIAL_SIGNATURE_POSITION);
    setSignatureSize(INITIAL_SIGNATURE_SIZE);
    setSignatureRotation(INITIAL_SIGNATURE_ROTATION);
  };

  const rotateSignature = (amount: number) => {
    setSignatureRotation((current) => normalizeRotation(current + amount));
  };

  if (isAuthLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-foreground/15 p-6">
          <h1 className="text-2xl font-semibold">Checking sign-in status</h1>
          <p className="mt-2 text-foreground/70">Please wait while NovaQuill confirms your account.</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-foreground/15 p-6">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-foreground/70">
            Sign in before signing documents so NovaQuill can track your credits and saved documents.
          </p>
          <Link
            href="/login?next=/upload"
            className="mt-5 inline-flex items-center rounded-md bg-[color:var(--color-accent)] px-5 py-3 text-white transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-foreground/15 p-6">
          <h1 className="text-2xl font-semibold">No PDF selected</h1>
          <p className="mt-2 text-foreground/70">
            Upload a PDF first. After selection, NovaQuill will open the editor immediately.
          </p>
          <Link
            href="/upload"
            className="mt-5 inline-flex items-center rounded-md bg-[color:var(--color-accent)] px-5 py-3 text-white transition hover:opacity-90"
          >
            Upload PDF
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-4 text-2xl font-semibold">Sign Document</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded-md border p-3">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("decrease")}
              aria-label="Zoom out"
            >
              -
            </button>
            <div className="text-sm">Zoom {(scale * 100).toFixed(0)}%</div>
            <button
              className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("increase")}
              aria-label="Zoom in"
            >
              +
            </button>
            <div className="ml-0 flex items-center gap-2 sm:ml-4">
              <button
                className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handlePageChange("prev")}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                Prev
              </button>
              <div className="text-sm">Page {page} / {numPages}</div>
              <button
                className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => handlePageChange("next")}
                disabled={page >= numPages}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
            <button
              className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleAddText}
              disabled={!pdfSize}
              aria-label="Add fill text to document"
            >
              Add Fill Text
            </button>
            <button
              className="rounded-md border px-3 py-1 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleAddCheckmark}
              disabled={!pdfSize}
              aria-label="Add checkbox mark to document"
            >
              Add Checkmark
            </button>
          </div>

          <div className="relative inline-block min-w-fit">
            <PdfViewer onSize={handlePdfSize} onMeta={({ numPages }) => setNumPages(numPages)} page={page} scale={scale} />
            {pdfSize && (
              <DocumentFillLayer
                pdfSize={pdfSize}
                page={page}
                sigDataUrl={sigDataUrl}
                signaturePosition={pos}
                signatureSize={signatureSize}
                signatureRotation={signatureRotation}
                textElements={textElements}
                onSignaturePositionChange={setPos}
                onSignatureSizeChange={setSignatureSize}
                onTextElementsChange={setTextElements}
                onClearSignature={clearSignature}
              />
            )}
          </div>
        </div>
        <div className="sticky top-6">
          <SignatureTools onSignature={handleSignature} />
          <div className="mt-4 rounded-md border border-foreground/10 p-3">
            <div className="mb-1 text-sm font-medium">Fill tools</div>
            <div className="text-xs text-foreground/60">
              Use Add Fill Text for names, dates, addresses, amounts, and form answers. Use Add Checkmark for checkbox-style fields. Drag each item into place before generating the final preview.
            </div>
          </div>
          {sigDataUrl && (
            <div className="mt-4 rounded-md border border-foreground/10 p-3">
              <div className="mb-2 text-sm font-medium">Signature rotation</div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border px-3 py-1 text-sm hover:bg-foreground/5"
                  onClick={() => rotateSignature(-ROTATION_STEP)}
                  type="button"
                >
                  Rotate left
                </button>
                <button
                  className="rounded-md border px-3 py-1 text-sm hover:bg-foreground/5"
                  onClick={() => rotateSignature(ROTATION_STEP)}
                  type="button"
                >
                  Rotate right
                </button>
              </div>
              <div className="mt-2 text-xs text-foreground/60">Current angle: {signatureRotation}°</div>
            </div>
          )}
          <div className="mt-4 text-xs text-foreground/60">
            Generate Preview before downloading. Credits are only used after the user confirms the final preview.
          </div>
          <div className="mt-4">
            <Finalizer
              sigDataUrl={sigDataUrl}
              page={page}
              x={pos.x}
              y={pos.y}
              width={signatureSize.width}
              height={signatureSize.height}
              rotation={signatureRotation}
              textElements={textElements}
              pdfViewportSize={pdfSize}
              pdfViewportSizes={pdfPageSizes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
