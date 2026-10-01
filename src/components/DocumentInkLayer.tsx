"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { inkBounds, inkPath, smoothInk, type InkPoint, type InkStroke } from "@/lib/documentInk";

export function paintInk(context: CanvasRenderingContext2D, stroke: InkStroke) {
  if (!stroke.points.length) return;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (stroke.points.length === 1) {
    const point = stroke.points[0]!;
    context.beginPath(); context.arc(point.x, point.y, stroke.width / 2, 0, 2 * Math.PI); context.fill();
  } else context.stroke(new Path2D(inkPath(stroke.points)));
}

// This image is only created if the user opts to save their handwriting for reuse.
// Signing the current PDF exports the strokes directly as vector paths.
export function imageOfInk(strokes: InkStroke[]): string | null {
  const bounds = inkBounds(strokes);
  if (!bounds) return null;
  const canvas = document.createElement("canvas");
  const ratio = 3;
  canvas.width = Math.ceil(bounds.width * ratio); canvas.height = Math.ceil(bounds.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(ratio, ratio); context.translate(-bounds.x, -bounds.y);
  strokes.forEach((stroke) => paintInk(context, stroke));
  return canvas.toDataURL("image/png");
}

export default function DocumentInkLayer({ size, scale, page, enabled, strokes, color, penWidth, onStroke, onDrawingChange }: {
  size: { width: number; height: number }; scale: number; page: number; enabled: boolean;
  strokes: InkStroke[]; color: string; penWidth: number;
  onStroke: (stroke: InkStroke) => void;
  onDrawingChange: (drawing: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<InkStroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    context.save(); context.scale(ratio * scale, ratio * scale);
    strokes.filter((stroke) => stroke.page === page).forEach((stroke) => paintInk(context, stroke));
    if (draftRef.current) paintInk(context, draftRef.current);
    context.restore();
  }, [strokes, page, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(size.width * ratio); canvas.height = Math.ceil(size.height * ratio);
    paint();
  }, [size.width, size.height, paint]);
  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

  const coordinates = (event: PointerEvent<HTMLCanvasElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(size.width, (event.clientX - rect.left) * size.width / rect.width)) / scale,
      y: Math.max(0, Math.min(size.height, (event.clientY - rect.top) * size.height / rect.height)) / scale };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0 || pointerRef.current !== null) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    draftRef.current = { page, points: [coordinates(event)], color, width: penWidth, viewport: { width: size.width / scale, height: size.height / scale } };
    onDrawingChange(true); paint();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerRef.current || !draftRef.current) return;
    event.preventDefault();
    const point = coordinates(event);
    const last = draftRef.current.points.at(-1)!;
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.25) return;
    draftRef.current.points.push(point);
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => { frameRef.current = null; paint(); });
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerRef.current || !draftRef.current) return;
    event.preventDefault();
    const stroke = draftRef.current;
    if (event.type === "pointerup") {
      const last = stroke.points.at(-1)!;
      const end = coordinates(event);
      if (Math.hypot(end.x - last.x, end.y - last.y) > 0.25) stroke.points.push(end);
    }
    stroke.points = smoothInk(stroke.points, 0.9);
    draftRef.current = null; pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onStroke(stroke); onDrawingChange(false); paint();
  };

  return <canvas ref={canvasRef} aria-label={enabled ? "Draw your signature directly on this PDF page" : "Signature ink on PDF page"} role="img"
    className={`absolute left-0 top-0 ${enabled ? "z-30 cursor-crosshair touch-none" : "pointer-events-none z-20"}`}
    style={{ width: size.width, height: size.height }}
    onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />;
}
