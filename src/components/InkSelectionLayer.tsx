"use client";

import { useState, type PointerEvent } from "react";
import { inkBounds, inkGroupId, transformInkGroup, type InkStroke } from "@/lib/documentInk";

type Bounds = NonNullable<ReturnType<typeof inkBounds>>;

export default function InkSelectionLayer({ strokes, page, scale, size, onChange, selected, onSelect }: {
  strokes: InkStroke[]; page: number; scale: number; size: { width: number; height: number };
  onChange: (strokes: InkStroke[]) => void; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; resize: boolean; x: number; y: number; bounds: Bounds; strokes: InkStroke[] } | null>(null);
  const groups = [...new Set(strokes.filter((stroke) => stroke.page === page).map(inkGroupId))];
  const begin = (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, id: string, bounds: Bounds, resize: boolean) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(id); setDrag({ id, resize, x: event.clientX, y: event.clientY, bounds, strokes });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = (event.clientX - drag.x) / scale, dy = (event.clientY - drag.y) / scale;
    const from = drag.bounds;
    const maxWidth = size.width / scale - from.x, maxHeight = size.height / scale - from.y;
    const ratio = drag.resize ? Math.max(Math.min(0.25, maxWidth / from.width, maxHeight / from.height), Math.min((from.width + dx) / from.width, maxWidth / from.width, maxHeight / from.height)) : 1;
    const to = drag.resize ? { ...from, width: from.width * ratio, height: from.height * ratio } : {
      ...from, x: Math.max(0, Math.min(size.width / scale - from.width, from.x + dx)), y: Math.max(0, Math.min(size.height / scale - from.height, from.y + dy)),
    };
    onChange(transformInkGroup(drag.strokes, drag.id, from, to));
  };
  return <div className="pointer-events-none absolute inset-0 z-25" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
    {groups.map((id) => {
      const bounds = inkBounds(strokes.filter((stroke) => inkGroupId(stroke) === id));
      if (!bounds) return null;
      const isSelected = selected === id;
      return <div key={id} role="button" tabIndex={0} aria-label="Move completed signature" className={`pointer-events-auto absolute cursor-move touch-none rounded ${isSelected ? "ring-2 ring-[color:var(--color-accent)]" : "hover:ring-1 hover:ring-[color:var(--color-accent)]"}`}
        style={{ left: bounds.x * scale, top: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale }}
        onPointerDown={(event) => begin(event, id, bounds, false)} onClick={(event) => { event.stopPropagation(); onSelect(id); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(id); }
          const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const direction = directions[event.key];
          if (direction) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; onChange(transformInkGroup(strokes, id, bounds, { ...bounds, x: Math.max(0, Math.min(size.width / scale - bounds.width, bounds.x + direction[0] * step)), y: Math.max(0, Math.min(size.height / scale - bounds.height, bounds.y + direction[1] * step)) })); }
        }}>
        {isSelected && <button type="button" aria-label="Resize completed signature" className="absolute -bottom-5 -right-5 grid h-10 w-10 touch-none place-items-center rounded-full border bg-background text-foreground shadow"
          onPointerDown={(event) => begin(event, id, bounds, true)} onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => { if (event.key !== "+" && event.key !== "-") return; event.preventDefault(); event.stopPropagation(); const ratio = event.key === "+" ? 1.1 : 0.9; if (bounds.x + bounds.width * ratio > size.width / scale || bounds.y + bounds.height * ratio > size.height / scale) return; onChange(transformInkGroup(strokes, id, bounds, { ...bounds, width: bounds.width * ratio, height: bounds.height * ratio })); }}>↘</button>}
      </div>;
    })}
  </div>;
}
