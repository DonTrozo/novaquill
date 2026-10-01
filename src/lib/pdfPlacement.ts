import { PDFPage } from "pdf-lib";

export type ViewportSize = { width: number; height: number };

// Map the displayed PDF (top-left origin) back into its native page space,
// including CropBox offsets and the PDF's own /Rotate value.
export function pagePlacement(page: PDFPage, viewport?: ViewportSize | null) {
  const crop = page.getCropBox();
  const media = page.getMediaBox();
  const x = Math.max(crop.x, media.x);
  const y = Math.max(crop.y, media.y);
  const width = Math.min(crop.x + crop.width, media.x + media.width) - x;
  const height = Math.min(crop.y + crop.height, media.y + media.height) - y;
  const box = width > 0 && height > 0 ? { x, y, width, height } : media;
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const sideways = angle === 90 || angle === 270;
  const displayWidth = sideways ? box.height : box.width;
  const displayHeight = sideways ? box.width : box.height;
  const sx = displayWidth / (viewport?.width || displayWidth);
  const sy = displayHeight / (viewport?.height || displayHeight);
  const point = (x: number, y: number) => {
    const u = x * sx;
    const v = y * sy;
    if (angle === 90) return { x: box.x + v, y: box.y + u };
    if (angle === 180) return { x: box.x + box.width - u, y: box.y + v };
    if (angle === 270) return { x: box.x + box.width - v, y: box.y + box.height - u };
    return { x: box.x + u, y: box.y + box.height - v };
  };
  return { point, sx, sy, angle };
}

export function signaturePlacement(page: PDFPage, viewport: ViewportSize | null | undefined,
  box: { x: number; y: number; width: number; height: number; rotation: number }) {
  const map = pagePlacement(page, viewport);
  const center = map.point(box.x + box.width / 2, box.y + box.height / 2);
  // CSS positive rotation is clockwise; PDF positive rotation is anticlockwise.
  const angle = map.angle - box.rotation;
  const rad = angle * Math.PI / 180;
  const width = box.width * map.sx;
  const height = box.height * map.sy;
  return {
    x: center.x - width / 2 * Math.cos(rad) + height / 2 * Math.sin(rad),
    y: center.y - width / 2 * Math.sin(rad) - height / 2 * Math.cos(rad),
    width, height, angle,
  };
}
