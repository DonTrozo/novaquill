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
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
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
  const panRef = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
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
  const toolsRef = useRef<HTMLDetailsElement | null>(null);
  const zoomScrollRef = useRef<{ left: number; top: number } | null>(null);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const isAuthLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  const handlePdfSize = (size: PdfSize) => {
    if (!autoFitDone.current && viewerContainerRef.current) {
      autoFitDone.current = true;
      const fitted = clamp((viewerContainerRef.current.clientWidth - 26) * scale / size.width, MIN_SCALE, INITIAL_SCALE);
      if (Math.abs(fitted - scale) > 0.01) { setScale(fitted); return; }
    }
    if (zoomScrollRef.current && viewerContainerRef.current) {
      viewerContainerRef.current.scrollLeft = zoomScrollRef.current.left;
      viewerContainerRef.current.scrollTop = zoomScrollRef.current.top;
      zoomScrollRef.current = null;
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
    const viewer = viewerContainerRef.current;
    if (viewer) zoomScrollRef.current = { left: (viewer.scrollLeft + viewer.clientWidth / 2) * ratio - viewer.clientWidth / 2, top: (viewer.scrollTop + viewer.clientHeight / 2) * ratio - viewer.clientHeight / 2 };
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
    setActiveTool("select");
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
    if (toolsRef.current) toolsRef.current.open = false;
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
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Sign your PDF</h1>
        <SigningUsageNotice state={allowanceState} compact />
      </div>
      <div className="sticky top-0 z-40 mb-3 rounded-lg border border-foreground/15 bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button type="button" disabled={drawing || !pdfReady} aria-pressed={activeTool === "draw"}
            onClick={() => { setActiveTool(activeTool === "draw" ? "select" : "draw"); if (toolsRef.current) toolsRef.current.open = false; }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${activeTool === "draw" ? "border border-foreground/20" : "bg-[color:var(--color-accent)] text-white"}`}>
            {activeTool === "draw" ? "Done signing" : "Sign"}
          </button>
          {activeTool === "draw" && inkStrokes.some((stroke) => stroke.page === page) && <button type="button" onClick={undoInk} disabled={drawing} className="px-2 py-2 text-sm underline">Undo</button>}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => handleScaleChange("decrease")} disabled={drawing} aria-label="Zoom out" className="rounded border px-3 py-2">−</button>
            <button type="button" onClick={fitWidth} disabled={drawing || !pdfReady} aria-label="Fit page width" title="Fit page width" className="min-w-12 px-1 py-2 text-xs">{Math.round(scale * 100)}%</button>
            <button type="button" onClick={() => handleScaleChange("increase")} disabled={drawing} aria-label="Zoom in" className="rounded border px-3 py-2">+</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-foreground/60" role="status">{activeTool === "draw" ? "Draw your signature. ShapeAssist is automatic. Tap Done signing to move around." : activeTool === "select" ? "Scroll or pinch to find your spot, then tap Sign. Drag to move around on desktop." : `Tap the document to add ${TOOL_LABELS[activeTool].toLowerCase()}.`}</p>
      </div>
      <details ref={toolsRef} className="mb-3 rounded-lg border border-foreground/15 px-3 py-2">
        <summary className="cursor-pointer text-sm">More tools</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">{(["select", "text", "initials", "date", "checkbox"] as EditorTool[]).map((tool) => <button key={tool} type="button" className={toolButtonClass(tool)} disabled={drawing} onClick={() => { setActiveTool(tool); if (toolsRef.current) toolsRef.current.open = false; }}>{tool === "select" ? "Navigate" : TOOL_LABELS[tool]}</button>)}</div>
          <details><summary className="cursor-pointer text-sm">Saved, typed or uploaded signature</summary><div className="mt-3"><SignatureTools key={signatureLibraryVersion} onSignature={handleSignature} drawingEnabled={false} /></div></details>
          <details><summary className="cursor-pointer text-sm">Pen options</summary><div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">Colour <input type="color" aria-label="Drawing colour" value={inkColor} disabled={drawing} onChange={(e) => setInkColor(e.target.value)} /></label>
            <label className="flex items-center gap-2">Pen width <input type="range" min="1" max="6" step="0.5" value={inkWidth} disabled={drawing} aria-label="Drawing pen width" onChange={(e) => setInkWidth(Number(e.target.value))} /></label>
          </div></details>
          {inkStrokes.some((stroke) => stroke.page === page) && <div className="flex flex-wrap gap-2">
            <button type="button" onClick={undoInk} disabled={drawing} className="rounded border px-3 py-2 text-sm">Undo stroke</button>
            <button type="button" onClick={() => { setInkStrokes((current) => current.filter((stroke) => stroke.page !== page)); setRedoInk([]); }} disabled={drawing} className="rounded border px-3 py-2 text-sm">Clear page ink</button>
            <button type="button" onClick={() => void saveDocumentInk()} disabled={savingInk || drawing} className="rounded border px-3 py-2 text-sm">{savingInk ? "Saving…" : "Save signature for next time"}</button>
          </div>}
          {redoInk.some((stroke) => stroke.page === page) && <button type="button" onClick={redoLastInk} disabled={drawing} className="rounded border px-3 py-2 text-sm">Redo stroke</button>}
          {saveInkMessage && <p role="status" className="text-sm">{saveInkMessage}</p>}
          {sigDataUrl && !signaturePlaced && <p className="text-sm">Tap the document to place your chosen signature.</p>}
          {sigDataUrl && signaturePlaced && <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => rotateSignature(-ROTATION_STEP)} className="rounded border px-3 py-2 text-sm">Rotate left</button>
            <button type="button" onClick={() => rotateSignature(ROTATION_STEP)} className="rounded border px-3 py-2 text-sm">Rotate right</button>
            <button type="button" onClick={() => setActiveTool("signature")} className="rounded border px-3 py-2 text-sm">Move signature</button>
          </div>}
          {sigDataUrl && signaturePixelWidth > 0 && signaturePixelWidth < signatureSize.width / scale * 2 && <p role="status" className="text-sm">This image may look pixelated. Use a smaller size or a higher-resolution image.</p>}
          <Link href="/upload" className="inline-block text-sm underline">Choose another PDF</Link>
        </div>
      </details>
      {numPages > 1 && <div className="mb-2 flex items-center justify-center gap-4 text-sm">
        <button type="button" onClick={() => handlePageChange("prev")} disabled={drawing || page <= 1} aria-label="Previous page" className="rounded border px-3 py-1 disabled:opacity-30">‹</button>
        <span>Page {page} of {numPages}</span>
        <button type="button" onClick={() => handlePageChange("next")} disabled={drawing || page >= numPages} aria-label="Next page" className="rounded border px-3 py-1 disabled:opacity-30">›</button>
      </div>}
      <div ref={viewerContainerRef} aria-label="Scrollable PDF document" className={`max-h-[65svh] min-h-64 overflow-auto overscroll-contain rounded-md border p-3 ${activeTool === "select" ? "cursor-grab" : ""}`}
        style={{ touchAction: activeTool === "draw" ? "none" : "pan-x pan-y pinch-zoom" }}
        onPointerDown={(event) => {
          if (activeTool !== "select" || event.pointerType !== "mouse" || event.button !== 0 || !(event.target instanceof HTMLElement) || event.target.dataset.navigationSurface !== "true") return;
          const node = event.currentTarget;
          panRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop };
          node.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => { const pan = panRef.current; if (pan?.id !== event.pointerId) return; event.currentTarget.scrollLeft = pan.left - event.clientX + pan.x; event.currentTarget.scrollTop = pan.top - event.clientY + pan.y; }}
        onPointerUp={(event) => { if (panRef.current?.id === event.pointerId) { panRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { panRef.current = null; }}>
        <div className="relative inline-block min-w-fit">
          <PdfViewer onSize={handlePdfSize} onMeta={({ numPages }) => setNumPages(numPages)} page={page} scale={scale} />
          {pdfSize && pdfReady && <DocumentFillLayer pdfSize={pdfSize} page={page} activeTool={activeTool === "draw" ? "select" : activeTool}
            sigDataUrl={sigDataUrl} signaturePlaced={signaturePlaced && signaturePage === page} signaturePosition={pos} signatureSize={signatureSize} signatureRotation={signatureRotation}
            textElements={textElements} onToolPlaced={handleToolPlaced} onSignaturePositionChange={setPos} onSignatureSizeChange={setSignatureSize} onTextElementsChange={setTextElements} onClearSignature={clearSignature} />}
          {pdfSize && pdfReady && <DocumentInkLayer size={pdfSize} scale={scale} page={page} enabled={activeTool === "draw"} strokes={inkStrokes} color={inkColor} penWidth={inkWidth}
            onStroke={(stroke) => { setInkStrokes((current) => [...current, stroke]); setRedoInk([]); setSaveInkMessage(null); }} onDrawingChange={setDrawing} />}
        </div>
      </div>
      <div className="sticky bottom-0 z-40 mt-3 border-t border-foreground/10 bg-background py-3">
        <Finalizer sigDataUrl={signaturePlaced ? sigDataUrl : null} page={signaturePage} x={pos.x} y={pos.y} width={signatureSize.width} height={signatureSize.height} rotation={signatureRotation}
          textElements={textElements} inkStrokes={inkStrokes} drawing={drawing || !pdfReady} pdfViewportSize={pdfPageSizes[signaturePage]} pdfViewportSizes={pdfPageSizes} />
      </div>
    </div>
  );
}
