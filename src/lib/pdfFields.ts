export type DetectedField = {
  id: string; x: number; y: number; width: number; height: number;
  label: string; fieldName?: string; value?: string;
};

type Viewport = { width: number; height: number; convertToViewportPoint: (x: number, y: number) => number[]; convertToViewportRectangle: (rect: number[]) => number[] };
type Matrix = number[];
const identity = [1, 0, 0, 1, 0, 0];
function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]! * b[0]! + a[2]! * b[1]!, a[1]! * b[0]! + a[3]! * b[1]!, a[0]! * b[2]! + a[2]! * b[3]!, a[1]! * b[2]! + a[3]! * b[3]!, a[0]! * b[4]! + a[2]! * b[5]! + a[4]!, a[1]! * b[4]! + a[3]! * b[5]! + a[5]!];
}

// PDF widgets are exact fields. Printed rules and boxes are suggestions only.
export function detectPdfFields(annotations: Array<Record<string, unknown>>, textItems: Array<{ str: string; transform: number[]; width: number; height: number }>, operators: { fnArray: number[]; argsArray: unknown[][] }, ops: Record<string, number>, viewport: Viewport, scale: number): DetectedField[] {
  const fields: DetectedField[] = [];
  const rect = (points: number[][]) => {
    const xs = points.map((point) => point[0]!), ys = points.map((point) => point[1]!);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  const add = (candidate: DetectedField) => {
    if (candidate.x < 0 || candidate.y < 0 || candidate.width <= 0 || candidate.height <= 0 || candidate.x + candidate.width > viewport.width + 1 || candidate.y + candidate.height > viewport.height + 1) return;
    if (fields.some((field) => Math.abs(field.x - candidate.x) < 8 * scale && Math.abs(field.y - candidate.y) < 12 * scale && Math.abs(field.width - candidate.width) < 15 * scale)) return;
    fields.push(candidate);
  };
  for (const annotation of annotations) {
    if (annotation.subtype !== "Widget" || annotation.fieldType !== "Tx" || annotation.readOnly || !Array.isArray(annotation.rect)) continue;
    const r = viewport.convertToViewportRectangle(annotation.rect as number[]);
    add({ id: `widget-${annotation.id}`, ...rect([[r[0]!, r[1]!], [r[2]!, r[3]!]]), label: String(annotation.alternativeText || annotation.fieldName || "Text field"), fieldName: String(annotation.fieldName), value: typeof annotation.fieldValue === "string" ? annotation.fieldValue : "" });
  }
  const labels = textItems.map((item) => {
    const point = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
    return { ...item, x: point[0]!, y: point[1]!, displayWidth: item.width * scale };
  });
  const labelAt = (x: number, y: number) => labels.filter((item) => !/^[_ .–-]+$/.test(item.str) && Math.abs(item.y - y) < 30 * scale && item.x < x + 10 * scale && item.x + item.displayWidth > x - 180 * scale).sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]?.str;
  for (const item of labels) {
    if (!/_{3,}|\.{6,}/.test(item.str)) continue;
    // Locate the blank part of a combined label + underline text run.
    const match = /_{3,}|\.{6,}/.exec(item.str)!;
    const characterWidth = item.displayWidth / item.str.length;
    add({ id: `blank-${fields.length}`, x: item.x + match.index * characterWidth, y: item.y - 22 * scale, width: match[0].length * characterWidth, height: 22 * scale, label: item.str.slice(0, match.index).trim() || "Fill in text" });
  }
  let matrix = identity.slice(); const stack: Matrix[] = [];
  let pending: Array<{ box: boolean; points: number[][] }> = [];
  const point = (x: number, y: number) => viewport.convertToViewportPoint(matrix[0]! * x + matrix[2]! * y + matrix[4]!, matrix[1]! * x + matrix[3]! * y + matrix[5]!);
  for (let index = 0; index < operators.fnArray.length; index++) {
    const op = operators.fnArray[index], args = operators.argsArray[index] || [];
    if (op === ops.save) stack.push(matrix.slice());
    else if (op === ops.restore) matrix = stack.pop() || identity.slice();
    else if (op === ops.transform) matrix = multiply(matrix, args as number[]);
    else if (op === ops.constructPath) {
      const commands = args[0] as number[], values = args[1] as number[];
      let cursor = 0, previous: number[] | null = null, corners: number[][] = [];
      for (const command of commands) {
        if (command === ops.rectangle) {
          const [x, y, w, h] = values.slice(cursor, cursor + 4) as [number, number, number, number]; cursor += 4;
          pending.push({ box: true, points: [point(x, y), point(x + w, y), point(x, y + h), point(x + w, y + h)] });
        } else if (command === ops.moveTo || command === ops.lineTo) {
          const next = point(values[cursor++]!, values[cursor++]!);
          if (command === ops.moveTo) corners = [];
          corners.push(next);
          if (command === ops.lineTo && previous) pending.push({ box: false, points: [previous, next] });
          previous = next;
        } else if (command === ops.curveTo) { cursor += 6; previous = null; }
        else if (command === ops.curveTo2 || command === ops.curveTo3) { cursor += 4; previous = null; }
        else if (command === ops.closePath && corners.length === 4 && corners.every((corner, i) => { const next = corners[(i + 1) % 4]!; return Math.abs(corner[0]! - next[0]!) < 1 || Math.abs(corner[1]! - next[1]!) < 1; })) {
          pending.push({ box: true, points: corners });
        }
      }
    } else if ([ops.stroke, ops.closeStroke, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke].includes(op!)) {
      for (const path of pending) {
        const r = rect(path.points);
        if (r.width < 45 * scale || r.width > 500 * scale) continue;
        const label = labelAt(r.x, r.y + r.height);
        if (path.box && r.height >= 14 * scale && r.height <= 65 * scale) {
          add({ id: `box-${fields.length}`, ...r, label: label || "Text box" });
        } else if (!path.box && r.height < 2 * scale && label) {
          add({ id: `line-${fields.length}`, ...r, y: r.y - 22 * scale, height: 22 * scale, label });
        }
      }
      pending = [];
    } else if ([ops.fill, ops.eoFill, ops.endPath].includes(op!)) pending = [];
  }
  return fields;
}
