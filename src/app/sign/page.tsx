"use client";

import Link from "next/link";
import PdfViewer from "@/components/PdfViewer";
import SignatureTools from "@/components/SignatureTools";
import DocumentFillLayer, { type EditorTool, type TextElement } from "@/components/DocumentFillLayer";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useUpload } from "@/context/UploadContext";
import Finalizer from "./Finalizer";

const INITIAL_SIGNATURE_SIZE = { width: 200, height: 80 };
const INITIAL_SIGNATURE_ROTATION = 0;
const INITIAL_SCALE = 1.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.1;
const ROTATION_STEP = 15;

type PdfSize = { width: number; height: number };
type Point = { x: number; y: number };

const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Select",
  text: "Text",
  signature: "Signature",
  initials: "Initials",
  date: "Date",
  checkbox: "Checkbox",
};

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function todayValue() {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function SignPage() {
  const { file } = useUpload();
  const { status } = useSession();
  const [pdfSize, setPdfSize] = useState<PdfSize | null>(null);
  const [pdfPageSizes, setPdfPageSizes] = useState<Record<number, PdfSize>>({});
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [signaturePlaced, setSignaturePlaced] = useState(false);
  const [pos, setPos] = useState<Point>({ x: 20, y: 20 });
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
      if (direction === "increase") return Math.min(MAX_SCALE, currentScale + SCALE_STEP);
      return Math.max(MIN_SCALE, currentScale - SCALE_STEP);
    });
  };

  const handlePageChange = (direction: "next" | "prev") => {
    setPage((currentPage) => {
      if (direction === "next") return Math.min(numPages, currentPage + 1);
      return Math.max(1, currentPage - 1);
    });
    setActiveTool("select");
  };

  const addTextElement = (point: Point, tool: EditorTool) => {
    if (!pdfSize) return;

    const defaults = {
      text: "",
      width: Math.min(220, Math.max(80, pdfSize.width - 60)),
      height: 36,
      fontSize: 14,
    };

    const config =
      tool === "date"
        ? { text: todayValue(), width: 130, height: 34, fontSize: 14 }
        : tool === "checkbox"
          ? { text: "X", width: 32, height: 32, fontSize: 18 }
          : tool === "initials"
            ? { text: "", width: 80, height: 34, fontSize: 16 }
            : defaults;

    const x = clamp(point.x - config.width / 2, 0, pdfSize.width - config.width);
    const y = clamp(point.y - config.height / 2, 0, pdfSize.height - config.height);

    setTextElements((current) => [
      ...current,
      {
        id: `${tool}-${Date.now()}`,
        page,
        x,
        y,
        width: config.width,
        height: config.height,
        text: config.text,
        fontSize: config.fontSize,
      },
    ]);
    setActiveTool("select");
  };

  const handleToolPlaced = (point: Point) => {
    if (!pdfSize) return;

    if (activeTool === "signature") {
      if (!sigDataUrl) return;
      setPos({
        x: clamp(point.x - signatureSize.width / 2, 0, pdfSize.width - signatureSize.width),
        y: clamp(point.y - signatureSize.height / 2, 0, pdfSize.height - signatureSize.height),
      });
      setSignaturePlaced(true);
      setActiveTool("select");
      return;
    }

    if (["text", "initials", "date", "checkbox"].includes(activeTool)) {
      addTextElement(point, activeTool);
    }
  };

  const handleSignature = (dataUrl: string) => {
    setSigDataUrl(dataUrl);
    setSignaturePlaced(false);
    setSignatureSize(INITIAL_SIGNATURE_SIZE);
    setSignatureRotation(INITIAL_SIGNATURE_ROTATION);
    setActiveTool("signature");
  };

  const clearSignature = () => {
    setSigDataUrl(null);
    setSignaturePlaced(false);
    setPos({ x: 20, y: 20 });
    setSignatureSize(INITIAL_SIGNATURE_SIZE);
    setSignatureRotation(INITIAL_SIGNATURE_ROTATION);
    setActiveTool("select");
  };

  const rotateSignature = (amount: number) => {
    setSignatureRotation((current) => normalizeRotation(current + amount));
  };

  const toolButtonClass = (tool: EditorTool) =>
    `rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      activeTool === tool
        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white"
        : "border-foreground/20 hover:bg-foreground/5"
    }`;

  const toolHint = (() => {
    if (activeTool === "signature" && !sigDataUrl) return "Create or choose a signature first, then click Signature to place it.";
    if (activeTool === "signature") return "Click the document where the signature should go.";
    if (activeTool === "text") return "Click the document where text should go.";
    if (activeTool === "initials") return "Click the document where initials should go.";
    if (activeTool === "date") return "Click the document where the date should go.";
    if (activeTool === "checkbox") return "Click the document where the checkbox mark should go.";
    return "Choose a tool, then click the document to place it. Drag items to adjust them.";
  })();

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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fill & Sign</h1>
          <p className="mt-1 text-sm text-foreground/70">Add what you need, preview the final PDF, then download.</p>
        </div>
        <Link href="/upload" className="text-sm underline underline-offset-4">
          Upload another PDF
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-foreground/15 bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Add:</span>
          {(["select", "text", "signature", "initials", "date", "checkbox"] as EditorTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              className={toolButtonClass(tool)}
              onClick={() => setActiveTool(tool)}
              disabled={tool === "signature" && !sigDataUrl}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
          <div className="ml-0 flex items-center gap-2 sm:ml-auto">
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("decrease")}
              aria-label="Zoom out"
            >
              -
            </button>
            <div className="min-w-16 text-center text-sm">{(scale * 100).toFixed(0)}%</div>
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("increase")}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-foreground/60">{toolHint}</div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded-md border p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange("prev")}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              Prev
            </button>
            <div className="text-sm">Page {page} / {numPages}</div>
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange("next")}
              disabled={page >= numPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>

          <div className="relative inline-block min-w-fit">
            <PdfViewer onSize={handlePdfSize} onMeta={({ numPages }) => setNumPages(numPages)} page={page} scale={scale} />
            {pdfSize && (
              <DocumentFillLayer
                pdfSize={pdfSize}
                page={page}
                activeTool={activeTool}
                sigDataUrl={sigDataUrl}
                signaturePlaced={signaturePlaced}
                signaturePosition={pos}
                signatureSize={signatureSize}
                signatureRotation={signatureRotation}
                textElements={textElements}
                onToolPlaced={handleToolPlaced}
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
          {sigDataUrl && !signaturePlaced && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Signature ready. Click <strong>Signature</strong>, then click the document where it should appear.
            </div>
          )}
          {sigDataUrl && signaturePlaced && (
            <div className="mt-4 rounded-md border border-foreground/10 p-3">
              <div className="mb-2 text-sm font-medium">Signature</div>
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
              <button
                type="button"
                onClick={() => setActiveTool("signature")}
                className="mt-2 w-full rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5"
              >
                Move by clicking page
              </button>
              <div className="mt-2 text-xs text-foreground/60">Current angle: {signatureRotation}°</div>
            </div>
          )}
          <div className="mt-4 rounded-md border border-foreground/10 p-3 text-xs text-foreground/60">
            Preview comes before download. Credits are only used when the final signed PDF is downloaded.
          </div>
          <div className="mt-4">
            <Finalizer
              sigDataUrl={signaturePlaced ? sigDataUrl : null}
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
