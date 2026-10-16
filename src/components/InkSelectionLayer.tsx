"use client";

import { useLanguage } from "@/context/LanguageContext";

import { useRef, useState, type PointerEvent } from "react";
import { inkBounds, inkGroupId, rotateInkGroup, transformInkGroup, type InkStroke } from "@/lib/documentInk";

type Bounds = NonNullable<ReturnType<typeof inkBounds>>;

export default function InkSelectionLayer({ strokes, page, scale, size, onChange, selected, onSelect }: {
  strokes: InkStroke[]; page: number; scale: number; size: { width: number; height: number };
  onChange: (strokes: InkStroke[]) => void; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const { t } = useLanguage();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize" | "rotate"; x: number; y: number; cx: number; cy: number; angle: number; bounds: Bounds; strokes: InkStroke[] } | null>(null);
  const groups = [...new Set(strokes.filter((stroke) => stroke.page === page).map(inkGroupId))];
  const begin = (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, id: string, bounds: Bounds, mode: "move" | "resize" | "rotate") => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const rect = surfaceRef.current!.getBoundingClientRect();
    const cx = rect.left + (bounds.x + bounds.width / 2) * scale;
    const cy = rect.top + (bounds.y + bounds.height / 2) * scale;
    onSelect(id); setDrag({ id, mode, x: event.clientX, y: event.clientY, cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), bounds, strokes });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (drag.mode === "rotate") {
      const angle = (Math.atan2(event.clientY - drag.cy, event.clientX - drag.cx) - drag.angle) * 180 / Math.PI;
      onChange(rotateInkGroup(drag.strokes, drag.id, page, angle, { width: size.width / scale, height: size.height / scale }));
      return;
    }
    const dx = (event.clientX - drag.x) / scale, dy = (event.clientY - drag.y) / scale;
    const from = drag.bounds;
    const maxWidth = size.width / scale - from.x, maxHeight = size.height / scale - from.y;
    const ratio = drag.mode === "resize" ? Math.max(Math.min(0.25, maxWidth / from.width, maxHeight / from.height), Math.min((from.width + dx) / from.width, maxWidth / from.width, maxHeight / from.height)) : 1;
    const to = drag.mode === "resize" ? { ...from, width: from.width * ratio, height: from.height * ratio } : {
      ...from, x: Math.max(0, Math.min(size.width / scale - from.width, from.x + dx)), y: Math.max(0, Math.min(size.height / scale - from.height, from.y + dy)),
    };
    onChange(transformInkGroup(drag.strokes, drag.id, from, to));
  };
  return <div ref={surfaceRef} className="pointer-events-none absolute inset-0 z-25" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
    {groups.map((id) => {
      const bounds = inkBounds(strokes.filter((stroke) => inkGroupId(stroke) === id));
      if (!bounds) return null;
      const isSelected = selected === id;
      return <div key={id} role="button" tabIndex={0} aria-label={t("Move completed signature")} className={`pointer-events-auto absolute cursor-move touch-none rounded ${isSelected ? "ring-2 ring-[color:var(--color-accent)]" : "hover:ring-1 hover:ring-[color:var(--color-accent)]"}`}
        style={{ left: bounds.x * scale, top: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale }}
        onPointerDown={(event) => begin(event, id, bounds, "move")} onClick={(event) => { event.stopPropagation(); onSelect(id); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(id); }
          const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const direction = directions[event.key];
          if (direction) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; onChange(transformInkGroup(strokes, id, bounds, { ...bounds, x: Math.max(0, Math.min(size.width / scale - bounds.width, bounds.x + direction[0] * step)), y: Math.max(0, Math.min(size.height / scale - bounds.height, bounds.y + direction[1] * step)) })); }
        }}>
        {isSelected && <button type="button" aria-label={t("Rotate signature freely")} title={t("Drag to rotate freely")}
          className="absolute grid h-11 w-11 touch-none cursor-grab place-items-center rounded-full border border-[color:var(--color-accent)] bg-background text-xl text-foreground shadow"
          style={{ left: Math.max(-bounds.x * scale, Math.min(bounds.width * scale / 2 - 22, size.width - bounds.x * scale - 44)), top: bounds.y * scale >= 56 ? -56 : Math.min(bounds.height * scale + 12, size.height - bounds.y * scale - 44) }}
          onPointerDown={(event) => begin(event, id, bounds, "rotate")} onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault(); event.stopPropagation();
            onChange(rotateInkGroup(strokes, id, page, (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1), { width: size.width / scale, height: size.height / scale }));
          }}>↻</button>}
        {isSelected && <button type="button" aria-label={t("Resize completed signature")} className="absolute -bottom-5 -right-5 grid h-10 w-10 touch-none place-items-center rounded-full border bg-background text-foreground shadow"
          onPointerDown={(event) => begin(event, id, bounds, "resize")} onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => { if (event.key !== "+" && event.key !== "-") return; event.preventDefault(); event.stopPropagation(); const ratio = event.key === "+" ? 1.1 : 0.9; if (bounds.x + bounds.width * ratio > size.width / scale || bounds.y + bounds.height * ratio > size.height / scale) return; onChange(transformInkGroup(strokes, id, bounds, { ...bounds, width: bounds.width * ratio, height: bounds.height * ratio })); }}>↘</button>}
      </div>;
    })}
  </div>;
}
