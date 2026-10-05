export type InkPoint = { x: number; y: number };
export type InkStroke = {
  groupId?: string;
  page: number;
  points: InkPoint[];
  color: string;
  width: number;
  viewport: { width: number; height: number };
};

export function inkGroupId(stroke: InkStroke) {
  return stroke.groupId ?? `page-${stroke.page}`;
}

export function transformInkGroup(strokes: InkStroke[], groupId: string, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }): InkStroke[] {
  const ratio = to.width / from.width;
  return strokes.map((stroke) => inkGroupId(stroke) !== groupId ? stroke : {
    ...stroke,
    points: stroke.points.map((point) => ({ x: to.x + (point.x - from.x) * ratio, y: to.y + (point.y - from.y) * ratio })),
    width: stroke.width * ratio,
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
