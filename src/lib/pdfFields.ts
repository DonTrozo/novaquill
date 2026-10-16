import { matchingFont } from "./textLayout";

export type DetectedField = {
  id: string; x: number; y: number; width: number; height: number;
  label: string; fieldName?: string; value?: string; fontSize?: number; fontName?: string;
};

type Viewport = { width: number; height: number; convertToViewportPoint: (x: number, y: number) => number[]; convertToViewportRectangle: (rect: number[]) => number[] };
type Matrix = number[];
const identity = [1, 0, 0, 1, 0, 0];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]! * b[0]! + a[2]! * b[1]!, a[1]! * b[0]! + a[3]! * b[1]!, a[0]! * b[2]! + a[2]! * b[3]!, a[1]! * b[2]! + a[3]! * b[3]!, a[0]! * b[4]! + a[2]! * b[5]! + a[4]!, a[1]! * b[4]! + a[3]! * b[5]! + a[5]!];
}

// PDF widgets are exact fields. Printed rules and boxes are suggestions only.
export function detectPdfFields(annotations: Array<Record<string, unknown>>, textItems: Array<{ str: string; transform: number[]; width: number; height: number; fontName?: string }>, operators: { fnArray: number[]; argsArray: unknown[][] }, ops: Record<string, number>, viewport: Viewport, scale: number, styles: Record<string, { fontFamily?: string; fontName?: string; bold?: boolean; italic?: boolean }> = {}): DetectedField[] {
  const fields: DetectedField[] = [];
  const rect = (points: number[][]) => {
    const xs = points.map((point) => point[0]!), ys = points.map((point) => point[1]!);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  const add = (candidate: DetectedField) => {
    if (candidate.x < 0 || candidate.y < 0 || candidate.width <= 0 || candidate.height <= 0 || candidate.x + candidate.width > viewport.width + 1 || candidate.y + candidate.height > viewport.height + 1) return;
    if (fields.some((field) => Math.abs(field.x - candidate.x) < 1.5 * scale && Math.abs(field.y - candidate.y) < 1.5 * scale && Math.abs(field.width - candidate.width) < 3 * scale && Math.abs(field.height - candidate.height) < 3 * scale)) return;
    fields.push(candidate);
  };
  const readOnlyBoxes = annotations.filter((annotation) => annotation.subtype === "Widget" && annotation.readOnly && Array.isArray(annotation.rect)).map((annotation) => {
    const r = viewport.convertToViewportRectangle(annotation.rect as number[]);
    return rect([[r[0]!, r[1]!], [r[2]!, r[3]!]]);
  });
  for (const annotation of annotations) {
    if (annotation.subtype !== "Widget" || annotation.fieldType !== "Tx" || annotation.readOnly || !Array.isArray(annotation.rect)) continue;
    const r = viewport.convertToViewportRectangle(annotation.rect as number[]);
    const appearance = annotation.defaultAppearanceData as { fontSize?: number; fontName?: string } | undefined;
    add({ fontSize: appearance?.fontSize ? appearance.fontSize * scale : undefined, fontName: appearance?.fontName ? matchingFont(appearance.fontName) : undefined, id: `widget-${annotation.id}`, ...rect([[r[0]!, r[1]!], [r[2]!, r[3]!]]), label: String(annotation.alternativeText || annotation.fieldName || "Text field"), fieldName: String(annotation.fieldName), value: typeof annotation.fieldValue === "string" ? annotation.fieldValue : "" });
  }
  const labels = textItems.map((item) => {
    const point = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
    const style = styles[item.fontName ?? ""];
    return { ...item, x: point[0]!, y: point[1]!, displayWidth: item.width * scale,
      fontSize: Math.hypot(item.transform[2]!, item.transform[3]!) * scale,
      matchedFont: matchingFont(style?.fontName || style?.fontFamily, style?.bold, style?.italic) };
  });
  const labelAt = (x: number, y: number) => labels.filter((item) => !/^[_ .–-]+$/.test(item.str) && Math.abs(item.y - y) < 30 * scale && item.x < x + 10 * scale && item.x + item.displayWidth > x - 180 * scale).sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]?.str;
  for (const item of labels) {
    if (!/_{3,}|\.{6,}/.test(item.str)) continue;
    // Locate the blank part of a combined label + underline text run.
    const match = /_{3,}|\.{6,}/.exec(item.str)!;
    const characterWidth = item.displayWidth / item.str.length;
    add({ id: `blank-${fields.length}`, x: item.x + match.index * characterWidth, y: item.y - 22 * scale, width: match[0].length * characterWidth, height: 22 * scale, label: item.str.slice(0, match.index).trim() || "Fill in text" });
  }
  type Segment = { x1: number; y1: number; x2: number; y2: number };
  const lines: Segment[] = [];
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  let matrix = identity.slice(); const stack: Matrix[] = [];
  let pendingLines: Segment[] = [], pendingBoxes: typeof boxes = [];
  const point = (x: number, y: number) => viewport.convertToViewportPoint(matrix[0]! * x + matrix[2]! * y + matrix[4]!, matrix[1]! * x + matrix[3]! * y + matrix[5]!);
  const segment = (a: number[], b: number[]) => ({ x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]! });
  const flush = (stroked: boolean) => {
    if (stroked) { lines.push(...pendingLines); boxes.push(...pendingBoxes); }
    // Some PDF generators draw table rules as narrow filled rectangles.
    for (const box of pendingBoxes) {
      if (box.height <= 2.5 * scale && box.width >= 20 * scale) lines.push({ x1: box.x, x2: box.x + box.width, y1: box.y + box.height / 2, y2: box.y + box.height / 2 });
      if (box.width <= 2.5 * scale && box.height >= 8 * scale) lines.push({ x1: box.x + box.width / 2, x2: box.x + box.width / 2, y1: box.y, y2: box.y + box.height });
    }
    pendingLines = []; pendingBoxes = [];
  };
  for (let index = 0; index < operators.fnArray.length; index++) {
    const op = operators.fnArray[index], args = operators.argsArray[index] || [];
    if (op === ops.save) stack.push(matrix.slice());
    else if (op === ops.restore) matrix = stack.pop() || identity.slice();
    else if (op === ops.transform) matrix = multiply(matrix, args as number[]);
    else if (op === ops.constructPath) {
      const commands = args[0] as number[], values = args[1] as number[];
      let cursor = 0, previous: number[] | null = null, first: number[] | null = null, corners: number[][] = [];
      for (const command of commands) {
        if (command === ops.rectangle) {
          const [x, y, w, h] = values.slice(cursor, cursor + 4) as [number, number, number, number]; cursor += 4;
          const corners = [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h)];
          pendingBoxes.push(rect(corners));
          corners.forEach((p, i) => pendingLines.push(segment(p, corners[(i + 1) % 4]!)));
          previous = corners[0]!; first = previous;
        } else if (command === ops.moveTo || command === ops.lineTo) {
          const next = point(values[cursor++]!, values[cursor++]!);
          if (command === ops.moveTo) { first = next; corners = []; }
          else if (previous) pendingLines.push(segment(previous, next));
          corners.push(next);
          previous = next;
        } else if (command === ops.closePath && previous && first) {
          pendingLines.push(segment(previous, first)); previous = first;
          if (corners.length === 4 && corners.every((corner, i) => { const next = corners[(i + 1) % 4]!; return Math.abs(corner[0]! - next[0]!) <= 0.01 || Math.abs(corner[1]! - next[1]!) <= 0.01; })) pendingBoxes.push(rect(corners));
        } else if (command === ops.curveTo) { cursor += 6; previous = null; }
        else if (command === ops.curveTo2 || command === ops.curveTo3) { cursor += 4; previous = null; }
      }
    } else if ([ops.stroke, ops.closeStroke, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke].includes(op!)) flush(true);
    else if ([ops.fill, ops.eoFill].includes(op!)) flush(false);
    else if (op === ops.endPath) { pendingLines = []; pendingBoxes = []; }
  }
  const tolerance = 1.5 * scale;
  const horizontal = lines.filter((line) => Math.abs(line.y1 - line.y2) <= tolerance && Math.abs(line.x2 - line.x1) > 20 * scale)
    .map((line) => ({ y: (line.y1 + line.y2) / 2, left: Math.min(line.x1, line.x2), right: Math.max(line.x1, line.x2) }));
  const vertical = lines.filter((line) => Math.abs(line.x1 - line.x2) <= tolerance && Math.abs(line.y2 - line.y1) > 8 * scale)
    .map((line) => ({ x: (line.x1 + line.x2) / 2, top: Math.min(line.y1, line.y2), bottom: Math.max(line.y1, line.y2) }));
  const unique = (values: number[]) => values.sort((a, b) => a - b).filter((value, i, all) => i === 0 || value - all[i - 1]! > tolerance);
  const ys = unique(horizontal.map((line) => line.y));
  const covers = (y: number, left: number, right: number) => {
    const runs = horizontal.filter((line) => Math.abs(line.y - y) <= tolerance).sort((a, b) => a.left - b.left);
    let end = left;
    for (const run of runs) if (run.left <= end + tolerance && run.right >= end) end = Math.max(end, run.right);
    return end >= right - tolerance;
  };
  const occupied = (r: { x: number; y: number; width: number; height: number }) => labels.some((label) => label.str.trim() && !/^[_ .–-]+$/.test(label.str) &&
    label.x + label.displayWidth / 2 > r.x + tolerance && label.x + label.displayWidth / 2 < r.x + r.width - tolerance &&
    label.y - label.fontSize * 0.3 > r.y && label.y - label.fontSize * 0.3 < r.y + r.height);
  const candidateBox = (r: { x: number; y: number; width: number; height: number }, prefix: string) => {
    if (r.width < 35 * scale || r.height < 8 * scale || r.height > 100 * scale || occupied(r)) return;
    add({ id: `${prefix}-${Math.round(r.x / scale * 10)}-${Math.round(r.y / scale * 10)}`, ...r, label: labelAt(r.x, r.y + r.height * 0.7) || "Text box" });
  };
  // Reconstruct empty table cells even when every border is a separate path.
  for (let topIndex = 0; topIndex < ys.length; topIndex++) {
    const top = ys[topIndex]!;
    for (let bottomIndex = topIndex + 1; bottomIndex < ys.length; bottomIndex++) {
      const bottom = ys[bottomIndex]!;
      if (bottom - top > 100 * scale) break;
      if (bottom - top < 8 * scale) continue;
      const xs = unique(vertical.filter((line) => line.top <= top + tolerance && line.bottom >= bottom - tolerance).map((line) => line.x));
      for (let column = 0; column < xs.length - 1; column++) {
        const left = xs[column]!, right = xs[column + 1]!;
        if (!covers(top, left, right) || !covers(bottom, left, right) || ys.some((middle) => middle > top + tolerance && middle < bottom - tolerance && covers(middle, left, right))) continue;
        candidateBox({ x: left, y: top, width: right - left, height: bottom - top }, "cell");
      }
    }
  }
  for (const box of boxes) candidateBox(box, "box");
  for (const line of horizontal) {
    if (line.right - line.left < 45 * scale || fields.some((field) => line.y >= field.y - tolerance && line.y <= field.y + field.height + tolerance && line.left < field.x + field.width && line.right > field.x)) continue;
    const label = labelAt(line.left, line.y);
    if (label) add({ id: `line-${Math.round(line.left / scale * 10)}-${Math.round(line.y / scale * 10)}`, x: line.left, y: line.y - 22 * scale, width: line.right - line.left, height: 22 * scale, label });
  }
  return fields.filter((field) => field.fieldName || !readOnlyBoxes.some((box) => field.x + field.width / 2 >= box.x && field.x + field.width / 2 <= box.x + box.width && field.y + field.height / 2 >= box.y && field.y + field.height / 2 <= box.y + box.height)).map((field) => {
    const nearest = labels.filter((label) => label.str.trim() && !/^[_ .–-]+$/.test(label.str)).sort((a, b) => {
      const distance = (label: typeof a) => Math.abs(label.y - (field.y + field.height * 0.7)) * 5 + Math.abs(label.x + label.displayWidth - field.x);
      return distance(a) - distance(b);
    })[0];
    return { ...field, fontSize: Math.min(field.fontSize || nearest?.fontSize || 11 * scale, field.height * 0.75), fontName: field.fontName || nearest?.matchedFont || "Helvetica" };
  });

}
