"use client";

import { SigningUsageNotice, useSigningUsage } from "@/components/SigningAllowanceNotice";

import Link from "next/link";
import PdfViewer from "@/components/PdfViewer";
import SignatureTools from "@/components/SignatureTools";
import DocumentInkLayer, { imageOfInk } from "@/components/DocumentInkLayer";
import type { InkStroke } from "@/lib/documentInk";
import DocumentFillLayer, { type EditorTool, type TextElement } from "@/components/DocumentFillLayer";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useUpload } from "@/context/UploadContext";
import Finalizer from "./Finalizer";

const INITIAL_SIGNATURE_SIZE = { width: 200, height: 80 };
const INITIAL_SIGNATURE_ROTATION = 0;
const INITIAL_SCALE = 1.2;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.1;
const ROTATION_STEP = 15;

type PdfSize = { width: number; height: number };
type Point = { x: number; y: number };

const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Select / move",
  draw: "Draw on document",
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
  const allowanceState = useSigningUsage();
  const { usage, checking, error: allowanceError } = allowanceState;
  const [allowanceApproved, setAllowanceApproved] = useState(false);
  useEffect(() => {
    if (usage && usage.subscription !== "ANON" && (usage.limit === null || usage.used < usage.limit)) setAllowanceApproved(true);
  }, [usage]);
  const { status } = useSession();
  const [pdfSize, setPdfSize] = useState<PdfSize | null>(null);
  const [pdfPageSizes, setPdfPageSizes] = useState<Record<number, PdfSize>>({});
  const [activeTool, setActiveTool] = useState<EditorTool>("draw");
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [signaturePixelWidth, setSignaturePixelWidth] = useState(0);
  const [signaturePage, setSignaturePage] = useState(1);
  const [signaturePlaced, setSignaturePlaced] = useState(false);
  const [pos, setPos] = useState<Point>({ x: 20, y: 20 });
  const [signatureSize, setSignatureSize] = useState(INITIAL_SIGNATURE_SIZE);
  const [signatureRotation, setSignatureRotation] = useState(INITIAL_SIGNATURE_ROTATION);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [redoInk, setRedoInk] = useState<InkStroke[]>([]);
  const [inkColor, setInkColor] = useState("#111111");
  const [inkWidth, setInkWidth] = useState(2);
  const [drawing, setDrawing] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [saveInkMessage, setSaveInkMessage] = useState<string | null>(null);
  const [savingInk, setSavingInk] = useState(false);
  const [signatureLibraryVersion, setSignatureLibraryVersion] = useState(0);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const autoFitDone = useRef(false);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const isAuthLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  const handlePdfSize = (size: PdfSize) => {
    if (!autoFitDone.current && viewerContainerRef.current) {
      autoFitDone.current = true;
      const fitted = clamp((viewerContainerRef.current.clientWidth - 26) * scale / size.width, MIN_SCALE, INITIAL_SCALE);
      if (Math.abs(fitted - scale) > 0.01) { setScale(fitted); return; }
    }
    setPdfReady(true);
    setPdfSize(size);
    setPdfPageSizes((current) => ({ ...current, [page]: size }));
  };

  const changeScale = (value: number) => {
    const next = clamp(value, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - scale) < 0.001) return;
    setPdfReady(false);
    const ratio = next / scale;
    setPos((current) => ({ x: current.x * ratio, y: current.y * ratio }));
    setSignatureSize((current) => ({ width: current.width * ratio, height: current.height * ratio }));
    setTextElements((current) => current.map((item) => ({ ...item, x: item.x * ratio, y: item.y * ratio, width: item.width * ratio, height: item.height * ratio, fontSize: item.fontSize * ratio })));
    setPdfPageSizes((current) => Object.fromEntries(Object.entries(current).map(([key, size]) => [key, { width: size.width * ratio, height: size.height * ratio }])));
    setScale(next);
  };

  const handleScaleChange = (direction: "increase" | "decrease") => changeScale(scale + (direction === "increase" ? SCALE_STEP : -SCALE_STEP));
  const fitWidth = () => {
    if (pdfSize && viewerContainerRef.current) changeScale((viewerContainerRef.current.clientWidth - 26) * scale / pdfSize.width);
  };

  const undoInk = () => {
    const index = inkStrokes.findLastIndex((stroke) => stroke.page === page);
    if (index < 0) return;
    setRedoInk((current) => [...current, inkStrokes[index]!]);
    setInkStrokes((current) => current.filter((_, i) => i !== index));
  };
  const redoLastInk = () => {
    const index = redoInk.findLastIndex((stroke) => stroke.page === page);
    if (index < 0) return;
    setInkStrokes((current) => [...current, redoInk[index]!]);
    setRedoInk((current) => current.filter((_, i) => i !== index));
  };
  const saveDocumentInk = async () => {
    setSavingInk(true); setSaveInkMessage(null);
    try {
      const dataUrl = imageOfInk(inkStrokes.filter((stroke) => stroke.page === page));
      if (!dataUrl) throw new Error("Draw a signature on this page first.");
      const response = await fetch("/api/signatures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, name: "Document signature" }) });
      if (!response.ok) throw new Error("Could not save for next time. Your signature is still on this document.");
      setSaveInkMessage("Saved for next time.");
      setSignatureLibraryVersion((value) => value + 1);
    } catch (err) { setSaveInkMessage(err instanceof Error ? err.message : "Could not save signature."); }
    finally { setSavingInk(false); }
  };

  const handlePageChange = (direction: "next" | "prev") => {
    setPdfReady(false);
    setPage((currentPage) => {
      if (direction === "next") return Math.min(numPages, currentPage + 1);
      return Math.max(1, currentPage - 1);
    });
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
      setSignaturePage(page);
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
    const image = new window.Image();
    image.onload = () => {
      setSignaturePixelWidth(image.naturalWidth);
      const ratio = image.naturalHeight / image.naturalWidth;
      const width = Math.min(200, 120 / ratio);
      setSignatureSize({ width, height: width * ratio });
    };
    image.src = dataUrl;
    setSignatureSize(INITIAL_SIGNATURE_SIZE);
    setSignatureRotation(INITIAL_SIGNATURE_ROTATION);
    setActiveTool("signature");
  };

  const clearSignature = () => {
    setSigDataUrl(null);
    setSignaturePixelWidth(0);
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
    if (activeTool === "draw") return "Sign directly on the document with your mouse, finger or pen. Choose Select / move to scroll or adjust other items.";
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
            Sign in to use your saved signatures and account.
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

  if (!allowanceApproved) {
    return <div className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-2xl font-semibold">{checking ? "Checking your allowance" : allowanceError ? "Could not check your allowance" : "Free monthly limit reached"}</h1>
      <SigningUsageNotice state={allowanceState} />
      {!checking && !allowanceError && <p>You have used the 3 free documents for this month. Upgrade to Pro for unlimited signing or return next month.</p>}
      <Link href="/pricing" className="inline-flex rounded-md bg-[color:var(--color-accent)] px-5 py-3 text-white">View Pro plans</Link>
    </div>;
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
          <p className="mt-1 text-sm text-foreground/70">Sign where your signature belongs, preview, then download.</p>
        </div>
        <Link href="/upload" className="text-sm underline underline-offset-4">
          Upload another PDF
        </Link>
      </div>

      <div className="mb-4"><SigningUsageNotice state={allowanceState} /></div>
      <div className="sticky top-0 z-40 mb-4 rounded-xl border border-foreground/15 bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Add:</span>
          {(["draw", "select", "text", "signature", "initials", "date", "checkbox"] as EditorTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              className={toolButtonClass(tool)}
              onClick={() => setActiveTool(tool)}
              disabled={drawing || (tool === "signature" && !sigDataUrl)}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
          <div className="ml-0 flex items-center gap-2 sm:ml-auto">
            <button type="button" onClick={fitWidth} disabled={drawing || !pdfReady} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Fit width</button>
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("decrease")}
              aria-label="Zoom out"
              disabled={drawing}
            >
              -
            </button>
            <div className="min-w-16 text-center text-sm">{(scale * 100).toFixed(0)}%</div>
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              onClick={() => handleScaleChange("increase")}
              aria-label="Zoom in"
              disabled={drawing}
            >
              +
            </button>
          </div>
        </div>
        {activeTool === "draw" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-3 text-sm">
          <label className="flex items-center gap-2">Colour <input type="color" aria-label="Drawing colour" value={inkColor} disabled={drawing} onChange={(event) => setInkColor(event.target.value)} /></label>
          <label className="flex items-center gap-2">Pen <input className="w-20" type="range" min="1" max="6" step="0.5" aria-label="Drawing pen width" value={inkWidth} disabled={drawing} onChange={(event) => setInkWidth(Number(event.target.value))} /></label>
          <span className="text-foreground/70">ShapeAssist is automatic</span>
          <button type="button" onClick={undoInk} disabled={drawing || !inkStrokes.some((stroke) => stroke.page === page)} className="rounded border px-3 py-1.5 disabled:opacity-40">Undo stroke</button>
          <button type="button" onClick={redoLastInk} disabled={drawing || !redoInk.some((stroke) => stroke.page === page)} className="rounded border px-3 py-1.5 disabled:opacity-40">Redo stroke</button>
          <button type="button" onClick={() => { setInkStrokes((current) => current.filter((stroke) => stroke.page !== page)); setRedoInk([]); }} disabled={drawing || !inkStrokes.some((stroke) => stroke.page === page)} className="rounded border px-3 py-1.5 disabled:opacity-40">Clear page ink</button>
        </div>}
        <div className="mt-2 text-sm text-foreground/70">{toolHint}</div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div ref={viewerContainerRef} className="min-w-0 overflow-auto rounded-md border p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange("prev")}
              disabled={drawing || page <= 1}
              aria-label="Previous page"
            >
              Prev
            </button>
            <div className="text-sm">Page {page} / {numPages}</div>
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePageChange("next")}
              disabled={drawing || page >= numPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>

          <div className="relative inline-block min-w-fit">
            <PdfViewer onSize={handlePdfSize} onMeta={({ numPages }) => setNumPages(numPages)} page={page} scale={scale} />
            {pdfSize && pdfReady && (
              <DocumentFillLayer
                pdfSize={pdfSize}
                page={page}
                activeTool={activeTool === "draw" ? "select" : activeTool}
                sigDataUrl={sigDataUrl}
                signaturePlaced={signaturePlaced && signaturePage === page}
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
            {pdfSize && pdfReady && <DocumentInkLayer size={pdfSize} scale={scale} page={page} enabled={activeTool === "draw"}
              strokes={inkStrokes} color={inkColor} penWidth={inkWidth}
              onStroke={(stroke) => { setInkStrokes((current) => [...current, stroke]); setRedoInk([]); setSaveInkMessage(null); }}
              onDrawingChange={setDrawing} />}
          </div>
        </div>
        <div className="space-y-4 lg:sticky lg:top-6">
          <p className="text-sm text-foreground/70">Your handwriting stays exactly where you draw it. Undo a stroke if you need to correct it.</p>
          <div className="mt-4">
            <Finalizer
              sigDataUrl={signaturePlaced ? sigDataUrl : null}
              page={signaturePage}
              x={pos.x}
              y={pos.y}
              width={signatureSize.width}
              height={signatureSize.height}
              rotation={signatureRotation}
              textElements={textElements}
              inkStrokes={inkStrokes}
              drawing={drawing || !pdfReady}
              pdfViewportSize={pdfPageSizes[signaturePage]}
              pdfViewportSizes={pdfPageSizes}
            />
          </div>
          <details className="rounded-lg border border-foreground/15 p-3">
            <summary className="cursor-pointer text-sm font-medium">Use a saved signature, type or upload</summary>
            <div className="mt-4"><SignatureTools key={signatureLibraryVersion} onSignature={handleSignature} drawingEnabled={false} /></div>
          </details>
          {inkStrokes.some((stroke) => stroke.page === page) && <div>
            <button type="button" onClick={() => void saveDocumentInk()} disabled={savingInk || drawing} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">{savingInk ? "Saving…" : "Save handwriting for next time"}</button>
            {saveInkMessage && <p role="status" className="mt-2 text-sm">{saveInkMessage}</p>}
          </div>}
          {sigDataUrl && signaturePixelWidth > 0 && signaturePixelWidth < signatureSize.width / scale * 2 && (
            <p role="status" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This image may look pixelated at this size. Make it smaller or use a higher-resolution image, drawn signature or typed signature.
            </p>
          )}
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
              <div className="mt-2 text-xs text-foreground/60">Current angle: {signatureRotation}° · Page {signaturePage}</div>
            </div>
          )}
          <div className="mt-4 rounded-md border border-foreground/10 p-3 text-xs text-foreground/60">
            Free: 3 completed documents per month. Previews are free. Pro adds unlimited signing and cloud document storage.
          </div>

        </div>
      </div>
    </div>
  );
}
