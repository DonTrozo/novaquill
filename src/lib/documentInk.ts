export type InkPoint = { x: number; y: number };
export type InkStroke = {
  groupId?: string;
  repeatOf?: string;
  page: number;
  points: InkPoint[];
  color: string;
  width: number;
  viewport: { width: number; height: number };
};

export function inkGroupId(stroke: InkStroke) {
  return stroke.groupId ?? `page-${stroke.page}`;
}

export function setInkGroupWidth(strokes: InkStroke[], groupId: string, page: number, width: number): InkStroke[] {
  if (!Number.isFinite(width) || width < 0.25) return strokes;
  return strokes.map((stroke) => stroke.page === page && inkGroupId(stroke) === groupId ? { ...stroke, width } : stroke);
}

// Keep the drawing's physical size and its offset from the nearest page edges.
// Each page gets its own group, so moving/deleting a copy stays page-specific.
export function repeatInkGroup(strokes: InkStroke[], groupId: string, page: number, pages: { width: number; height: number }[]): InkStroke[] {
  const selected = strokes.filter((stroke) => stroke.page === page && inkGroupId(stroke) === groupId);
  const sourceSize = pages[page - 1];
  if (!selected.length || !sourceSize || pages.some((size) => ![size.width, size.height].every((value) => Number.isFinite(value) && value > 0))) return strokes;
  const original = selected.map((stroke) => ({ ...stroke,
    width: stroke.width * sourceSize.width / stroke.viewport.width,
    points: stroke.points.map((point) => ({ x: point.x * sourceSize.width / stroke.viewport.width, y: point.y * sourceSize.height / stroke.viewport.height })),
    viewport: { ...sourceSize },
  }));
  const bounds = inkBounds(original);
  if (!bounds) return strokes;
  if (pages.some((size) => bounds.width > size.width || bounds.height > size.height)) throw new Error("Make these initials smaller before placing them on all pages.");
  const repeatOf = selected[0]!.repeatOf ?? `${page}:${groupId}`;
  const next = strokes.filter((stroke) => stroke.repeatOf !== repeatOf || stroke.page === page)
    .map((stroke) => stroke.page === page && inkGroupId(stroke) === groupId ? { ...stroke, repeatOf } : stroke);
  pages.forEach((size, index) => {
    const targetPage = index + 1;
    if (targetPage === page) return;
    let dx = bounds.x + bounds.width / 2 > sourceSize.width / 2 ? size.width - sourceSize.width : 0;
    let dy = bounds.y + bounds.height / 2 > sourceSize.height / 2 ? size.height - sourceSize.height : 0;
    dx += Math.max(0, -bounds.x - dx) + Math.min(0, size.width - bounds.x - dx - bounds.width);
    dy += Math.max(0, -bounds.y - dy) + Math.min(0, size.height - bounds.y - dy - bounds.height);
    next.push(...original.map((stroke) => ({ ...stroke, groupId: `repeat:${repeatOf}:${targetPage}`, repeatOf, page: targetPage,
      points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })), viewport: { ...size },
    })));
  });
  return next;
}

export function transformInkGroup(strokes: InkStroke[], groupId: string, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }): InkStroke[] {
  const ratio = to.width / from.width;
  return strokes.map((stroke) => inkGroupId(stroke) !== groupId ? stroke : {
    ...stroke,
    points: stroke.points.map((point) => ({ x: to.x + (point.x - from.x) * ratio, y: to.y + (point.y - from.y) * ratio })),
    width: stroke.width * ratio,
  });
}

// Rotate the actual vector points so the editor, saved drafts and PDF export agree.
export function rotateInkGroup(strokes: InkStroke[], groupId: string, page: number, angle: number, size: { width: number; height: number }): InkStroke[] {
  const matches = (stroke: InkStroke) => stroke.page === page && inkGroupId(stroke) === groupId;
  const bounds = inkBounds(strokes.filter(matches));
  if (!bounds || !Number.isFinite(angle)) return strokes;
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const rotated = strokes.map((stroke) => !matches(stroke) ? stroke : {
    ...stroke,
    points: stroke.points.map((point) => ({
      x: cx + (point.x - cx) * cos - (point.y - cy) * sin,
      y: cy + (point.x - cx) * sin + (point.y - cy) * cos,
    })),
  });
  const next = inkBounds(rotated.filter(matches))!;
  // Keep the full signature on the page without changing its size or shape.
  if (next.width > size.width || next.height > size.height) return strokes;
  const dx = Math.max(0, -next.x) + Math.min(0, size.width - next.x - next.width);
  const dy = Math.max(0, -next.y) + Math.min(0, size.height - next.y - next.height);
  return rotated.map((stroke) => !matches(stroke) ? stroke : {
    ...stroke, points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  });
}

export function smoothInk(points: InkPoint[], strength: number): InkPoint[] {
  const amount = Math.max(0, Math.min(1, strength));
  if (amount === 0 || points.length < 3) return points.map((point) => ({ ...point }));
  let result = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < Math.round(amount * 4); pass++) {
    result = result.map((point, index) => {
      if (index === 0 || index === result.length - 1) return point;
      const before = result[index - 1]!;
      const after = result[index + 1]!;
      return { x: (before.x + point.x * 2 + after.x) / 4, y: (before.y + point.y * 2 + after.y) / 4 };
    });
  }
  return result;
}

// One path definition is shared by the document overlay and vector PDF export.
export function inkPath(points: InkPoint[]): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index]!;
    const next = points[index + 1]!;
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  if (points.length > 1) {
    const last = points[points.length - 1]!;
    path += ` L ${last.x} ${last.y}`;
  }
  return path;
}

export function inkBounds(strokes: InkStroke[]) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of strokes) for (const point of stroke.points) {
    const padding = stroke.width / 2 + 2;
    left = Math.min(left, point.x - padding); top = Math.min(top, point.y - padding);
    right = Math.max(right, point.x + padding); bottom = Math.max(bottom, point.y + padding);
  }
  if (!Number.isFinite(left)) return null;
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
