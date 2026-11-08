"use client";

import { useLanguage } from "@/context/LanguageContext";

import Image from "next/image";
import { layoutText, cssFont, nativeInputBox, type TextGeometry } from "@/lib/textLayout";
import type { DetectedField } from "@/lib/pdfFields";
import { type MouseEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

export type TextElement = TextGeometry & {
  fieldName?: string;
  sourceFieldName?: string;
  detectedFieldId?: string;
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
};

export type EditorTool = "select" | "draw" | "signature" | "text" | "initials" | "date" | "checkbox";

type Size = { width: number; height: number };
type Point = { x: number; y: number };
type Selected = { kind: "signature" | "text"; id?: string } | null;
type DragKind = "move" | "resize";

type DragState = {
  target: "signature" | "text";
  id?: string;
  kind: DragKind;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const MIN_TEXT_WIDTH = 80;
const MIN_TEXT_HEIGHT = 28;
const MIN_SIGNATURE_WIDTH = 60;
const MIN_SIGNATURE_HEIGHT = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export default function DocumentFillLayer({
  pdfSize,
  scale = 1,
  page,
  activeTool,
  sigDataUrl,
  signaturePlaced,
  signaturePosition,
  signatureSize,
  signatureRotation,
  textElements,
  onToolPlaced,
  onSignaturePositionChange,
  onSignatureSizeChange,
  onSignatureRotationChange,
  onTextElementsChange,
  onClearSignature,
  detectedFields = [],
  onFieldPlaced,
  onTextMove,
}: {
  pdfSize: Size;
  scale?: number;
  page: number;
  activeTool: EditorTool;
  sigDataUrl: string | null;
  signaturePlaced: boolean;
  signaturePosition: Point;
  signatureSize: Size;
  signatureRotation: number;
  textElements: TextElement[];
  onToolPlaced: (point: Point) => void;
  onSignaturePositionChange: (position: Point) => void;
  onSignatureSizeChange: (size: Size) => void;
  onSignatureRotationChange: (rotation: number) => void;
  onTextElementsChange: (elements: TextElement[]) => void;
  onClearSignature: () => void;
  detectedFields?: DetectedField[];
  onFieldPlaced?: (field: DetectedField) => void;
  onTextMove?: (item: TextElement) => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Selected>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const knownTextIds = useRef(new Set(textElements.map((item) => item.id)));
  useEffect(() => {
    const added = textElements.findLast((item) => item.page === page && !knownTextIds.current.has(item.id));
    knownTextIds.current = new Set(textElements.map((item) => item.id));
    if (added) { setSelected({ kind: "text", id: added.id }); setEditingText(added.id); }
  }, [textElements, page]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [rotationDrag, setRotationDrag] = useState<{ cx: number; cy: number; angle: number; rotation: number } | null>(null);

  const pageTextElements = textElements.filter((item) => item.page === page);
  const placementMode = activeTool !== "select";
  const canEditSelection = activeTool === "select" || activeTool === "text";
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const scrolled = useRef(false);
  const moveRemembered = useRef(false);

  const updateText = (id: string, updates: Partial<TextElement>) => {
    const target = textElements.find((item) => item.id === id);
    onTextElementsChange(textElements.map((item) => (item.id === id || ((updates.text !== undefined || updates.fontSize !== undefined) && target?.fieldName && item.fieldName === target.fieldName) ? { ...item, ...updates } : item)));
  };

  const beginDrag = (
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    state: Omit<DragState, "startClientX" | "startClientY">
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveRemembered.current = false;
    setDragState({ ...state, startClientX: event.clientX, startClientY: event.clientY });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (rotationDrag) {
      const angle = Math.atan2(event.clientY - rotationDrag.cy, event.clientX - rotationDrag.cx);
      onSignatureRotationChange(((rotationDrag.rotation + (angle - rotationDrag.angle) * 180 / Math.PI) % 360 + 360) % 360);
      return;
    }
    if (!dragState) return;
    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;

    if (dragState.target === "signature") {
      if (dragState.kind === "resize") {
        const aspectRatio = dragState.startHeight / dragState.startWidth;
        const maxWidth = Math.min(pdfSize.width - dragState.startX, (pdfSize.height - dragState.startY) / aspectRatio);
        const minWidth = Math.min(maxWidth, Math.max(MIN_SIGNATURE_WIDTH * scale, MIN_SIGNATURE_HEIGHT * scale / aspectRatio));
        const nextWidth = clamp(dragState.startWidth + dx, minWidth, maxWidth);
        const nextHeight = nextWidth * aspectRatio;
        onSignatureSizeChange({ width: nextWidth, height: nextHeight });
      } else {
        onSignaturePositionChange({
          x: clamp(dragState.startX + dx, 0, pdfSize.width - dragState.startWidth),
          y: clamp(dragState.startY + dy, 0, pdfSize.height - dragState.startHeight),
        });
      }
      return;
    }

    if (!dragState.id) return;
    if (dragState.kind === "resize") {
      updateText(dragState.id, {
        width: clamp(dragState.startWidth + dx, MIN_TEXT_WIDTH, pdfSize.width - dragState.startX),
        height: clamp(dragState.startHeight + dy, MIN_TEXT_HEIGHT, pdfSize.height - dragState.startY),
      });
    } else {
      const item = textElements.find((item) => item.id === dragState.id);
      const x = clamp(dragState.startX + dx, 0, pdfSize.width - dragState.startWidth);
      const y = clamp(dragState.startY + dy, 0, pdfSize.height - dragState.startHeight);
      if (!item || (x === item.x && y === item.y)) return;
      if (!moveRemembered.current) { onTextMove?.(item); moveRemembered.current = true; }
      updateText(dragState.id, {
        ...(item?.fieldName ? { fieldName: undefined, sourceFieldName: item.fieldName } : {}),
        x,
        y,
      });
    }
  };

  const endDrag = () => {
    setDragState(null);
    setRotationDrag(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === "signature") {
      onClearSignature();
    } else if (selected.id) {
      onTextElementsChange(textElements.filter((item) => item.id !== selected.id));
    }
    setSelected(null);
  };

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (scrolled.current) return;
    if (!placementMode) {
      setSelected(null);
      setEditingText(null);
      return;
    }

    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onToolPlaced({
      x: clamp(event.clientX - rect.left, 0, pdfSize.width),
      y: clamp(event.clientY - rect.top, 0, pdfSize.height),
    });
    setSelected(null);
  };

  return (
    <div
      className={`absolute inset-0 ${placementMode ? "cursor-crosshair" : ""}`}
      style={{ width: pdfSize.width, height: pdfSize.height }}
      data-navigation-surface={!placementMode ? "true" : undefined}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => { scrolled.current = true; endDrag(); }}
      onPointerDownCapture={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; scrolled.current = false; }}
      onPointerMoveCapture={(event) => {
        const start = pointerStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) scrolled.current = true;
      }}
      onClick={handleCanvasClick}
    >
      {activeTool === "text" && detectedFields.filter((field) => !textElements.some((item) => item.id === `field-${page}-${field.id}` || (item.page === page && item.detectedFieldId === field.id))).map((field) => <button key={field.id} type="button" aria-label={t("Fill {label}", { label: field.label })} className={`absolute z-10 text-left ${activeTool === "text" ? "bg-cyan-500/10 hover:bg-cyan-500/20" : "bg-transparent hover:bg-cyan-500/10"}`} style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
        onClick={(event) => { event.stopPropagation(); if (!scrolled.current) onFieldPlaced?.(field); }} />)}
      {selected?.kind === "signature" && canEditSelection && (
        <button
          type="button"
          className="absolute right-2 top-2 z-20 rounded-md border bg-background px-2 py-1 text-xs shadow hover:bg-red-50 hover:text-red-700"
          onClick={(event) => {
            event.stopPropagation();
            deleteSelected();
          }}
        >
          {t("Delete signature")}
        </button>
      )}

      {pageTextElements.map((item) => {
        const isSelected = selected?.kind === "text" && selected.id === item.id;
        const layout = layoutText(item);
        const isEditing = editingText === item.id;
        return (
          <div
            key={item.id}
            data-text-item
            className={`absolute text-black ${isSelected ? "z-30 ring-1 ring-[color:var(--color-accent)]" : "z-10"}`}
            style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
            onClick={(event) => {
              event.stopPropagation();
              if (scrolled.current) return;
              setSelected({ kind: "text", id: item.id });
              setEditingText(activeTool === "select" ? null : item.id);
            }}
          >
            <div className="h-full w-full">
              <PositionedTextInput item={item} editing={isEditing && activeTool !== "select"} scrollMode={activeTool === "select"}
                label={t("Document text on page {page}", { page: item.page })} placeholder={t("Enter text")}
                onChange={(text) => updateText(item.id, { text })}
                onEdit={() => { if (scrolled.current) return; setSelected({ kind: "text", id: item.id }); setEditingText(activeTool === "select" ? null : item.id); }}
                onBlur={(target) => { setEditingText(null); if (!target?.closest("[data-text-item]")) setSelected(null); }} />

            </div>
            {isSelected && canEditSelection && (
              <div
                role="toolbar" aria-label={t("Text controls")}
                className="absolute left-0 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-black shadow"
                style={{ ...(item.y >= 96 ? { bottom: item.height + 8 } : { top: item.height + 8 }), width: Math.min(320, pdfSize.width), maxWidth: "calc(100vw - 3rem)", left: clamp(0, -item.x, pdfSize.width - item.x - Math.min(320, pdfSize.width)) }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label={t("Move text")}
                  className="min-h-10 cursor-move touch-none rounded border border-gray-400 bg-white px-3 text-black"
                  onPointerDown={(event) => beginDrag(event, {
                    target: "text", id: item.id, kind: "move",
                    startX: item.x, startY: item.y, startWidth: item.width, startHeight: item.height,
                  })}
                  onKeyDown={(event) => {
                    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                    const direction = directions[event.key];
                    if (!direction) return;
                    event.preventDefault(); event.stopPropagation();
                    const step = (event.shiftKey ? 10 : 1) * scale;
                    const x = clamp(item.x + direction[0] * step, 0, Math.max(0, pdfSize.width - item.width));
                    const y = clamp(item.y + direction[1] * step, 0, Math.max(0, pdfSize.height - item.height));
                    if (x === item.x && y === item.y) return;
                    onTextMove?.(item);
                    updateText(item.id, {
                      ...(item.fieldName ? { fieldName: undefined, sourceFieldName: item.fieldName } : {}),
                      x,
                      y,
                    });
                  }}
                >{t("↔ Move")}</button>{t("Size")}<TextFontSize value={layout.size / scale} label={t("Text font size in points")} onChange={(points) => updateText(item.id, { fontSize: points * scale, preferredFontSize: points * scale })} />
                pt
                <button type="button" aria-label={t("Delete text")}
                  className="min-h-10 rounded border border-red-700 bg-white px-2 text-red-700"
                  onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTextElementsChange(textElements.filter((entry) => entry.id !== item.id));
                    setSelected(null); setEditingText(null);
                  }}>{t("Delete")}</button>
              </div>
            )}
            {isSelected && canEditSelection && !item.fieldName && !item.detectedFieldId && (
              <div
                aria-label={t("Resize text")}
                className="absolute -bottom-3 -right-3 grid h-6 w-6 cursor-se-resize touch-none place-items-center"
                onPointerDown={(event) =>
                  beginDrag(event, {
                    target: "text",
                    id: item.id,
                    kind: "resize",
                    startX: item.x,
                    startY: item.y,
                    startWidth: item.width,
                    startHeight: item.height,
                  })
                }
              ><span className="pointer-events-none h-2.5 w-2.5 border border-[color:var(--color-accent)] bg-white" /></div>
            )}
          </div>
        );
      })}

      {sigDataUrl && signaturePlaced && (
        <div
          className={`absolute z-10 ${selected?.kind === "signature" ? "ring-2 ring-[color:var(--color-accent)] ring-offset-2" : ""}`}
          style={{
            left: signaturePosition.x,
            top: signaturePosition.y,
            width: signatureSize.width,
            height: signatureSize.height,
            transform: `rotate(${signatureRotation}deg)`,
            transformOrigin: "center center",
          }}
          onClick={(event) => {
            event.stopPropagation();
            setSelected({ kind: "signature" });
          }}
        >
          <div
            className="h-full w-full cursor-move touch-none"
            onPointerDown={(event) => {
              setSelected({ kind: "signature" });
              beginDrag(event, {
                target: "signature",
                kind: "move",
                startX: signaturePosition.x,
                startY: signaturePosition.y,
                startWidth: signatureSize.width,
                startHeight: signatureSize.height,
              });
            }}
          >
            <Image
              src={sigDataUrl}
              alt={t("Signature")}
              width={Math.round(signatureSize.width)}
              height={Math.round(signatureSize.height)}
              className="h-full w-full select-none object-contain"
              draggable={false}
              unoptimized
            />
          </div>
          {selected?.kind === "signature" && !placementMode && (
            <button type="button" aria-label={t("Rotate signature freely")} title={t("Drag to rotate freely")}
              style={{ top: signaturePosition.y >= 56 ? -56 : signatureSize.height + 12 }}
              className="absolute left-1/2 grid h-11 w-11 -translate-x-1/2 touch-none cursor-grab place-items-center rounded-full border border-[color:var(--color-accent)] bg-background text-xl text-foreground shadow"
              onPointerDown={(event) => {
                event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
                const rect = event.currentTarget.parentElement!.getBoundingClientRect();
                const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
                setRotationDrag({ cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), rotation: signatureRotation });
              }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault(); event.stopPropagation();
                onSignatureRotationChange(((signatureRotation + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)) % 360 + 360) % 360);
              }}>↻</button>
          )}
          {selected?.kind === "signature" && !placementMode && (
            <div
              aria-label={t("Resize signature")}
              className="absolute -bottom-4 -right-4 h-9 w-9 cursor-se-resize touch-none rounded-full border border-[color:var(--color-accent)] bg-background shadow"
              onPointerDown={(event) =>
                beginDrag(event, {
                  target: "signature",
                  kind: "resize",
                  startX: signaturePosition.x,
                  startY: signaturePosition.y,
                  startWidth: signatureSize.width,
                  startHeight: signatureSize.height,
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

// The same native input draws both the text and its caret, before and after blur.
// Position its line box using the browser font metrics and the PDF baseline.
function PositionedTextInput({ item, editing, scrollMode, label, placeholder, onChange, onEdit, onBlur }: {
  item: TextElement; editing: boolean; scrollMode: boolean; label: string; placeholder: string;
  onChange: (text: string) => void; onEdit: () => void; onBlur: (target: HTMLElement | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const layout = layoutText(item);
  const [metrics, setMetrics] = useState<{ ascent: number; descent: number } | null>(null);
  useLayoutEffect(() => {
    const node = input.current;
    const context = document.createElement("canvas").getContext("2d");
    if (!node || !context) return;
    const style = getComputedStyle(node);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const measured = context.measureText("Hg");
    setMetrics({ ascent: measured.fontBoundingBoxAscent, descent: measured.fontBoundingBoxDescent });
  }, [layout.size, item.fontName]);
  useEffect(() => {
    if (editing) input.current?.focus({ preventScroll: true });
    else input.current?.blur();
  }, [editing]);
  const box = nativeInputBox(layout, metrics);
  return <input ref={input} value={item.text} readOnly={!editing} aria-label={label}
    onChange={(event) => onChange(event.target.value)}
    data-navigation-surface={scrollMode ? "true" : undefined}
    onPointerDown={(event) => { if (!scrollMode) event.stopPropagation(); }}
    onClick={(event) => { event.stopPropagation(); onEdit(); }}
    onFocus={() => { if (!scrollMode) onEdit(); }}
    onBlur={(event) => onBlur(event.relatedTarget as HTMLElement | null)}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }}
    placeholder={editing ? placeholder : undefined}
    className="absolute w-full border-0 bg-transparent text-black outline-none placeholder:text-gray-600"
    style={{ ...cssFont(item.fontName), left: 0, top: box.top, height: box.height, lineHeight: `${box.height}px`,
      padding: `0 ${layout.padding}px`, margin: 0, border: 0, boxSizing: "border-box", appearance: "none",
      fontSize: layout.size, fontKerning: "none", letterSpacing: 0, color: "#000000", WebkitTextFillColor: "#000000",
      caretColor: editing ? "#000000" : "transparent", colorScheme: "light", textSizeAdjust: "none", boxShadow: "none", borderRadius: 0 }} />;
}

function TextFontSize({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input type="number" min="1" max="144" step="0.5" inputMode="decimal" aria-label={label}
    className="w-20 rounded border border-gray-400 bg-white px-2 py-1 text-base text-black focus:border-[color:var(--color-accent)]"
    style={{ colorScheme: "light" }} value={draft ?? Number(value.toFixed(2))}
    onFocus={() => setDraft(String(Number(value.toFixed(2))))}
    onChange={(event) => { setDraft(event.target.value); const number = event.target.valueAsNumber; if (Number.isFinite(number) && number >= 1 && number <= 144) onChange(number); }}
    onBlur={() => { const number = Number(draft); if (draft && Number.isFinite(number)) onChange(clamp(number, 1, 144)); setDraft(null); }}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}
