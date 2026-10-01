import type { InkStroke } from "./documentInk";

// Zoom is a view change, not a new document generation. Normalise UI geometry
// before identifying the output so zooming cannot spend another free credit.
export function documentVersion(input: {
  fileName?: string; fileSize?: number; fileLastModified?: number;
  sigDataUrl: string | null; page: number; x: number; y: number; width: number; height: number; rotation: number;
  textElements: { page: number; x: number; y: number; width: number; height: number; text: string; fontSize: number }[];
  inkStrokes: InkStroke[];
  viewportSizes: Record<number, { width: number; height: number }>;
}) {
  const rounded = (value: number) => Math.round(value * 1e8) / 1e8;
  const normalise = (page: number, x: number, y: number, width: number, height: number) => {
    const viewport = input.viewportSizes[page];
    return [rounded(x / (viewport?.width || 1)), rounded(y / (viewport?.height || 1)), rounded(width / (viewport?.width || 1)), rounded(height / (viewport?.height || 1))];
  };
  return JSON.stringify({
    file: [input.fileName, input.fileSize, input.fileLastModified],
    signature: input.sigDataUrl ? [input.sigDataUrl, input.page, input.rotation, ...normalise(input.page, input.x, input.y, input.width, input.height)] : null,
    text: input.textElements.map((item) => [item.page, item.text, rounded(item.fontSize / (input.viewportSizes[item.page]?.height || 1)), ...normalise(item.page, item.x, item.y, item.width, item.height)]),
    ink: input.inkStrokes,
  });
}
