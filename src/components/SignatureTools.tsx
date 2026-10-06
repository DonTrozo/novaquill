"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

export type SignatureKind = "draw" | "type" | "upload";

type Point = { x: number; y: number };
type SavedSignature = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string | Date;
};

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;
const DRAWING_LINE_WIDTH = 2;
const OUTPUT_SCALE = 3;
const ASSIST_STRENGTH = 0.9;
const MAX_SAVED_SIGNATURES = 8;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function simplifyPoints(points: Point[], minDistance: number): Point[] {
  if (points.length <= 2) return points;
  const simplified: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const candidate = points[i]!;
    const prev = simplified[simplified.length - 1]!;
    if (distance(prev, candidate) >= minDistance) {
      simplified.push(candidate);
    }
  }
  simplified.push(points[points.length - 1]!);
  return simplified;
}

function smoothPoints(points: Point[], passes: number): Point[] {
  if (points.length <= 2 || passes <= 0) return points;
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Point[] = [current[0]!];
    for (let i = 1; i < current.length - 1; i += 1) {
      const prev = current[i - 1]!;
      const center = current[i]!;
      const after = current[i + 1]!;
      next.push({
        x: (prev.x + center.x * 2 + after.x) / 4,
        y: (prev.y + center.y * 2 + after.y) / 4,
      });
    }
    next.push(current[current.length - 1]!);
    current = next;
  }
  return current;
}

function refineStroke(points: Point[], assistStrength: number): Point[] {
  const clampedStrength = Math.max(0, Math.min(1, assistStrength));
  const simplified = simplifyPoints(points, 0.5 + clampedStrength * 2.2);
  const passes = Math.max(1, Math.round(1 + clampedStrength * 3));
  return smoothPoints(simplified, passes);
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    const point = points[0]!;
    ctx.beginPath();
    ctx.arc(point.x, point.y, lineWidth / 1.4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const xc = (current.x + next.x) / 2;
    const yc = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, xc, yc);
  }
  const end = points[points.length - 1]!;
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function trimCanvas(canvas: HTMLCanvasElement, padding = 10): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return canvas;

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
  const out = document.createElement("canvas");
  out.width = Math.max(1, cropWidth);
  out.height = Math.max(1, cropHeight);
  const outCtx = out.getContext("2d");
  if (!outCtx) return canvas;
  outCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return out;
}

export default function SignatureTools({ onSignature, drawingEnabled = true }: { onSignature: (dataUrl: string) => void; drawingEnabled?: boolean }) {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const [color, setColor] = useState("#111111");
  const [lineWidth, setLineWidth] = useState(DRAWING_LINE_WIDTH);
  const [mode, setMode] = useState<SignatureKind>(drawingEnabled ? "draw" : "type");
  const [typed, setTyped] = useState("");
  const [font, setFont] = useState("cursive");
  const [name, setName] = useState("");
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [redoStrokeCount, setRedoStrokeCount] = useState(0);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const finalizedStrokesRef = useRef<Point[][]>([]);
  const redoStrokesRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  const syncStrokeCounts = useCallback(() => {
    setStrokeCount(finalizedStrokesRef.current.length);
    setRedoStrokeCount(redoStrokesRef.current.length);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Failed to initialize canvas");
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    finalizedStrokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, color, lineWidth));
    if (currentStrokeRef.current.length) drawStroke(ctx, currentStrokeRef.current, color, lineWidth);
  }, [color, lineWidth]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, mode]);

  useEffect(() => {
    if (!isSignedIn) { setSavedSignatures([]); setIsLoadingSaved(false); return; }
    let cancelled = false;
    async function loadSavedSignatures() {
      setIsLoadingSaved(true);
      try {
        const response = await fetch("/api/signatures", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load saved signatures");
        const payload = (await response.json()) as { signatures?: SavedSignature[] };
        if (!cancelled) setSavedSignatures((payload.signatures || []).slice(0, MAX_SAVED_SIGNATURES));
      } catch {
        if (!cancelled) {
          setSavedSignatures([]);
          setError("Could not load saved signatures. You can still create and use a new signature.");
        }
      } finally {
        if (!cancelled) setIsLoadingSaved(false);
      }
    }
    loadSavedSignatures();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const saveSignatureIfNeeded = async (dataUrl: string) => {
    if (!saveForFuture || !isSignedIn) return;
    const trimmedName = name.trim();
    const response = await fetch("/api/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, name: trimmedName || undefined }),
    });
    if (!response.ok) throw new Error("Signature is ready to use, but could not be saved for next time. Try saving it again later.");
    const payload = (await response.json()) as { signature: SavedSignature };
    setSavedSignatures((prev) => {
      const withoutDup = prev.filter((item) => item.id !== payload.signature.id);
      return [payload.signature, ...withoutDup].slice(0, MAX_SAVED_SIGNATURES);
    });
  };

  const applySignature = async (dataUrl: string, shouldSave = true) => {
    // Older saved signatures may be GIF/WebP: normalise them before PDF export.
    if (!/^data:image\/(png|jpe?g)[;,]/i.test(dataUrl)) {
      const image = new window.Image();
      image.src = dataUrl;
      try {
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not read signature image");
        context.drawImage(image, 0, 0);
        dataUrl = canvas.toDataURL("image/png");
      } catch {
        setError("Could not read this signature. Try a PNG or JPG image.");
        return;
      }
    }
    onSignature(dataUrl);
    setError(null);
    if (!shouldSave) return;
    try {
      await saveSignatureIfNeeded(dataUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signature is ready to use but could not be saved for next time";
      setError(message);
    }
  };

  const clearCanvas = () => {
    finalizedStrokesRef.current = [];
    redoStrokesRef.current = [];
    currentStrokeRef.current = [];
    syncStrokeCounts();
    redrawCanvas();
  };

  const undoStroke = () => {
    if (!finalizedStrokesRef.current.length || drawingRef.current) return;
    const nextFinalized = [...finalizedStrokesRef.current];
    const removed = nextFinalized.pop();
    if (!removed) return;
    finalizedStrokesRef.current = nextFinalized;
    redoStrokesRef.current = [...redoStrokesRef.current, removed];
    syncStrokeCounts();
    redrawCanvas();
  };

  const redoStroke = () => {
    if (!redoStrokesRef.current.length || drawingRef.current) return;
    const nextRedo = [...redoStrokesRef.current];
    const restored = nextRedo.pop();
    if (!restored) return;
    redoStrokesRef.current = nextRedo;
    finalizedStrokesRef.current = [...finalizedStrokesRef.current, restored];
    syncStrokeCounts();
    redrawCanvas();
  };

  const toDataUrl = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (mode === "draw") {
        if (!finalizedStrokesRef.current.length) throw new Error("Draw your signature first");
        const output = document.createElement("canvas");
        output.width = CANVAS_WIDTH * OUTPUT_SCALE;
        output.height = CANVAS_HEIGHT * OUTPUT_SCALE;
        const outputCtx = output.getContext("2d");
        if (!outputCtx) throw new Error("Canvas not available");
        outputCtx.clearRect(0, 0, output.width, output.height);
        outputCtx.scale(OUTPUT_SCALE, OUTPUT_SCALE);
        outputCtx.strokeStyle = color;
        outputCtx.lineWidth = lineWidth;
        outputCtx.lineCap = "round";
        outputCtx.lineJoin = "round";
        finalizedStrokesRef.current.forEach((stroke) => drawStroke(outputCtx, stroke, color, lineWidth));
        const cropped = trimCanvas(output);
        await applySignature(cropped.toDataURL("image/png"));
      } else if (mode === "type") {
        if (!typed.trim()) throw new Error("Please enter text for your signature");
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH * OUTPUT_SCALE;
        canvas.height = CANVAS_HEIGHT * OUTPUT_SCALE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to create temporary canvas");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(OUTPUT_SCALE, OUTPUT_SCALE);
        ctx.fillStyle = color;
        ctx.font = `64px ${font}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const text = typed.trim();
        const measured = ctx.measureText(text).width;
        if (measured > CANVAS_WIDTH - 40) ctx.font = `${64 * (CANVAS_WIDTH - 40) / measured}px ${font}`;
        ctx.fillText(text, 20, CANVAS_HEIGHT / 2);
        const cropped = trimCanvas(canvas);
        await applySignature(cropped.toDataURL("image/png"));
      } else if (mode === "upload") {
        if (!uploadedDataUrl) throw new Error("Please select an image file first");
        await applySignature(uploadedDataUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create signature";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setError("Image file must be smaller than 5MB");
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result !== "string") throw new Error("Failed to read image file");
        const image = new window.Image();
        image.src = reader.result;
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 20_000_000) throw new Error("Image dimensions are too large. Use an image below 20 megapixels.");
        const output = document.createElement("canvas");
        output.width = image.naturalWidth;
        output.height = image.naturalHeight;
        const context = output.getContext("2d");
        if (!context) throw new Error("Could not read this image");
        context.drawImage(image, 0, 0);
        const dataUrl = output.toDataURL("image/png");
        setUploadedDataUrl(dataUrl);
        await applySignature(dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read this image. Try PNG or JPG.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setIsProcessing(false);
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const removeSavedSignature = (id: string) => {
    fetch(`/api/signatures?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to remove signature");
        setSavedSignatures((prev) => prev.filter((item) => item.id !== id));
      })
      .catch(() => setError("Failed to remove saved signature"));
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [coords];
    redrawCanvas();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    currentStrokeRef.current = [...currentStrokeRef.current, coords];
    redrawCanvas();
  };

  const handleEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      const refined = refineStroke(currentStrokeRef.current, ASSIST_STRENGTH);
      finalizedStrokesRef.current = [...finalizedStrokesRef.current, refined];
      redoStrokesRef.current = [];
      syncStrokeCounts();
    }
    currentStrokeRef.current = [];
    redrawCanvas();
  };

  return (
    <div className="grid gap-4">
      {isSignedIn && <div className="rounded-lg border border-foreground/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Saved signatures</h3>
          <span className="text-xs text-foreground/60">{savedSignatures.length} saved</span>
        </div>
        {isLoadingSaved ? (
          <p className="text-xs text-foreground/65">Loading saved signatures...</p>
        ) : savedSignatures.length === 0 ? (
          <p className="text-xs text-foreground/65">Save a signature once and reuse it instantly in future documents.</p>
        ) : (
          <div className="grid gap-2 max-h-44 overflow-auto pr-1">
            {savedSignatures.map((signature) => (
              <div key={signature.id} className="rounded-md border border-foreground/15 p-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => void applySignature(signature.dataUrl, false)}
                  className="flex items-center gap-2 min-w-0 text-left hover:opacity-90"
                  aria-label={`Use saved signature ${signature.name}`}
                >
                  <div className="h-10 w-24 rounded bg-white border border-foreground/10 flex items-center justify-center overflow-hidden">
                    <Image src={signature.dataUrl} alt={signature.name} width={96} height={40} className="max-h-full max-w-full object-contain" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{signature.name}</p>
                    <p className="text-[11px] text-foreground/60">Tap to use</p>
                  </div>
                </button>
                <button onClick={() => removeSavedSignature(signature.id)} className="text-xs rounded-md border px-2 py-1 hover:bg-foreground/5" aria-label={`Remove saved signature ${signature.name}`}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}

      <div className="flex gap-2 flex-wrap">
        {drawingEnabled && <button onClick={() => setMode("draw")} className={`px-3 py-1 rounded-md border transition-colors ${mode === "draw" ? "bg-foreground/5 border-foreground/30" : "hover:bg-foreground/5"}`} aria-label="Draw signature">
          Draw
        </button>}
        <button onClick={() => setMode("type")} className={`px-3 py-1 rounded-md border transition-colors ${mode === "type" ? "bg-foreground/5 border-foreground/30" : "hover:bg-foreground/5"}`} aria-label="Type signature">
          Type
        </button>
        <button onClick={() => setMode("upload")} className={`px-3 py-1 rounded-md border transition-colors ${mode === "upload" ? "bg-foreground/5 border-foreground/30" : "hover:bg-foreground/5"}`} aria-label="Upload signature image">
          Upload
        </button>
      </div>

      {mode !== "upload" && (
        <div className="grid gap-3 rounded-lg border border-foreground/15 p-3">
          <label className="flex items-center justify-between text-sm">
            Signature colour
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Signature colour" />
          </label>
          {mode === "draw" && <>
            <label className="grid gap-1 text-sm">
              Pen width: {lineWidth}px
              <input type="range" min="1" max="6" step="0.5" value={lineWidth} onChange={(event) => setLineWidth(Number(event.target.value))} aria-label="Pen width" />
            </label>
            <p className="text-sm text-foreground/70">ShapeAssist is automatic</p>
          </>}
        </div>
      )}

      {mode === "draw" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Draw your signature</span>
            <div className="flex items-center gap-2">
              <button onClick={undoStroke} disabled={strokeCount === 0 || drawingRef.current} className="text-xs rounded-md border px-2 py-1 hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Undo last stroke">
                Undo
              </button>
              <button onClick={redoStroke} disabled={redoStrokeCount === 0 || drawingRef.current} className="text-xs rounded-md border px-2 py-1 hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Redo last undone stroke">
                Redo
              </button>
              <button onClick={clearCanvas} className="text-sm text-foreground/70 hover:text-foreground hover:underline" aria-label="Clear canvas">
                Clear
              </button>
            </div>
          </div>
          <div className="border rounded-md w-full">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="bg-white cursor-crosshair touch-none w-full h-auto max-w-full"
              onPointerDown={handleStart}
              onPointerMove={handleMove}
              onPointerUp={handleEnd}
                      onPointerCancel={handleEnd}
              style={{ touchAction: "none" }}
              role="img"
              aria-label="Signature drawing canvas"
            />
          </div>
          <p className="text-xs text-foreground/60">ShapeAssist automatically smooths each stroke when you lift your pen.</p>
        </div>
      )}

      {mode === "type" && (
        <div className="grid gap-3">
          <div>
            <label htmlFor="signature-text" className="block text-sm font-medium mb-2">Type your signature</label>
            <input id="signature-text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Enter your name or signature" className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:border-transparent" />
          </div>
          <div>
            <label htmlFor="signature-font" className="block text-sm font-medium mb-2">Font style</label>
            <select id="signature-font" value={font} onChange={(e) => setFont(e.target.value)} className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:border-transparent">
              <option value="cursive">Cursive</option>
              <option value="serif">Serif</option>
              <option value="sans-serif">Sans</option>
              <option value="monospace">Mono</option>
            </select>
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-3">
          <label htmlFor="signature-upload" className="block text-sm font-medium">Upload signature image</label>
          <input id="signature-upload" type="file" accept="image/*" onChange={handleFileUpload} className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:border-transparent" />
          <p className="text-xs text-foreground/70">Supported formats: JPG, PNG, GIF. Max size: 5MB. Choose the image, then click the document to place it. Its original colours are preserved.</p>
          {uploadedDataUrl && (
            <div className="rounded-md border border-foreground/15 p-2">
              <p className="text-xs text-foreground/70 mb-2">Preview</p>
              <div className="h-14 bg-white rounded border border-foreground/10 flex items-center justify-center">
                <Image src={uploadedDataUrl} alt="Uploaded signature preview" width={220} height={56} className="max-h-full max-w-full object-contain" unoptimized />
              </div>
            </div>
          )}
        </div>
      )}

      {isSignedIn && <div className="rounded-lg border border-foreground/15 p-3 space-y-3">
        <label htmlFor="signature-name" className="block text-xs font-medium">Save name (optional)</label>
        <input id="signature-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal signature" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] focus:border-transparent" />
        <label className="flex items-center justify-between text-sm">
          <span>Save this signature for future use</span>
          <input type="checkbox" checked={saveForFuture} onChange={(e) => setSaveForFuture(e.target.checked)} aria-label="Save signature for future use" />
        </label>
      </div>}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div>
        <button onClick={toDataUrl} disabled={isProcessing || (mode === "type" && !typed.trim())} className="w-full rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity" aria-label="Use this signature">
          {isProcessing ? "Processing..." : mode === "upload" && uploadedDataUrl ? "Place Uploaded Signature Again" : "Use Signature on Document"}
        </button>
      </div>
    </div>
  );
}
