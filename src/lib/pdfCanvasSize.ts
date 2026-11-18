// Bound backing-store memory even when a phone has a high device pixel ratio
// or a document contains unusually large pages. CSS dimensions retain the zoom.
export function pdfCanvasSize(width: number, height: number, devicePixelRatio: number) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid PDF page dimensions");
  }
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 2, 4096 / width, 4096 / height, Math.sqrt(4_000_000 / (width * height)));
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)), ratio };
}
