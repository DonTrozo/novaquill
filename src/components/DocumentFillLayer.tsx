"use client";

import Image from "next/image";
import { useState } from "react";

export type TextElement = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
};

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
  page,
  sigDataUrl,
  signaturePosition,
  signatureSize,
  signatureRotation,
  textElements,
  onSignaturePositionChange,
  onSignatureSizeChange,
  onTextElementsChange,
  onClearSignature,
}: {
  pdfSize: Size;
  page: number;
  sigDataUrl: string | null;
  signaturePosition: Point;
  signatureSize: Size;
  signatureRotation: number;
  textElements: TextElement[];
  onSignaturePositionChange: (position: Point) => void;
  onSignatureSizeChange: (size: Size) => void;
  onTextElementsChange: (elements: TextElement[]) => void;
  onClearSignature: () => void;
}) {
  const [selected, setSelected] = useState<Selected>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const pageTextElements = textElements.filter((item) => item.page === page);

  const updateText = (id: string, updates: Partial<TextElement>) => {
    onTextElementsChange(textElements.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const beginDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    state: Omit<DragState, "startClientX" | "startClientY">
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ ...state, startClientX: event.clientX, startClientY: event.clientY });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;

    if (dragState.target === "signature") {
      if (dragState.kind === "resize") {
        const nextWidth = clamp(dragState.startWidth + dx, MIN_SIGNATURE_WIDTH, pdfSize.width - dragState.startX);
        const aspectRatio = dragState.startHeight / dragState.startWidth;
        const nextHeight = clamp(nextWidth * aspectRatio, MIN_SIGNATURE_HEIGHT, pdfSize.height - dragState.startY);
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
      updateText(dragState.id, {
        x: clamp(dragState.startX + dx, 0, pdfSize.width - dragState.startWidth),
        y: clamp(dragState.startY + dy, 0, pdfSize.height - dragState.startHeight),
      });
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
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

  return (
    <div
      className="absolute inset-0"
      style={{ width: pdfSize.width, height: pdfSize.height }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={() => setSelected(null)}
    >
      {selected && (
        <button
          type="button"
          className="absolute right-2 top-2 z-20 rounded-md border bg-background px-2 py-1 text-xs shadow hover:bg-red-50 hover:text-red-700"
          onClick={(event) => {
            event.stopPropagation();
            deleteSelected();
          }}
        >
          Delete selected
        </button>
      )}

      {pageTextElements.map((item) => {
        const isSelected = selected?.kind === "text" && selected.id === item.id;
        return (
          <div
            key={item.id}
            className={`absolute z-10 rounded border bg-white/80 shadow-sm ${
              isSelected ? "border-[color:var(--color-accent)] ring-1 ring-[color:var(--color-accent)]" : "border-foreground/30"
            }`}
            style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
            onClick={(event) => {
              event.stopPropagation();
              setSelected({ kind: "text", id: item.id });
            }}
          >
            <div
              className="h-full w-full cursor-move"
              onPointerDown={(event) => {
                setSelected({ kind: "text", id: item.id });
                beginDrag(event, {
                  target: "text",
                  id: item.id,
                  kind: "move",
                  startX: item.x,
                  startY: item.y,
                  startWidth: item.width,
                  startHeight: item.height,
                });
              }}
            >
              <input
                value={item.text}
                onChange={(event) => updateText(item.id, { text: event.target.value })}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Enter text"
                className="h-full w-full bg-transparent px-2 outline-none"
                style={{ fontSize: item.fontSize }}
              />
            </div>
            {isSelected && (
              <div
                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border border-[color:var(--color-accent)] bg-background shadow"
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
              />
            )}
          </div>
        );
      })}

      {sigDataUrl && (
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
            className="h-full w-full cursor-move"
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
              alt="Signature"
              width={Math.round(signatureSize.width)}
              height={Math.round(signatureSize.height)}
              className="h-full w-full select-none object-contain"
              draggable={false}
              unoptimized
            />
          </div>
          <div
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border border-[color:var(--color-accent)] bg-background shadow"
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
        </div>
      )}
    </div>
  );
}
