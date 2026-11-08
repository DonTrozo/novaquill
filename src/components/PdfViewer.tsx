"use client";

import { useLanguage } from "@/context/LanguageContext";

import { useEffect, useRef, useState } from "react";
import { useUpload } from "@/context/UploadContext";
import { getDocument, GlobalWorkerOptions, OPS, type PDFDocumentProxy } from "pdfjs-dist";
import { detectPdfFields, type DetectedField } from "@/lib/pdfFields";
import LoadingSpinner from "./LoadingSpinner";
import { fitPreviewPage } from "@/lib/previewLayout";

if (typeof window !== "undefined") GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Size = { width: number; height: number };

function PdfCanvas({ source, page, scale, onSize, onMeta, onFields, onPageSize, preview = false }: {
  source: Blob | null; page: number; scale: number | null;
  onSize?: (size: Size) => void;
  onMeta?: (meta: { numPages: number }) => void;
  onFields?: (fields: DetectedField[]) => void;
  onPageSize?: (size: Size) => void;
  preview?: boolean;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSizeRef = useRef(onSize);
  const onMetaRef = useRef(onMeta);
  const onFieldsRef = useRef(onFields);
  const onPageSizeRef = useRef(onPageSize);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => { onSizeRef.current = onSize; onMetaRef.current = onMeta; onFieldsRef.current = onFields; onPageSizeRef.current = onPageSize; }, [onSize, onMeta, onFields, onPageSize]);

  // Parse once per file, rather than reloading the whole PDF on every zoom/page change.
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setPdf(null);
    setError(null);
    if (!source) return;
    setIsLoading(true);
    void source.arrayBuffer().then(async (bytes) => {
      if (cancelled) return;
      task = getDocument({ data: bytes });
      const loaded = await task.promise;
      if (!cancelled) {
        onMetaRef.current?.({ numPages: loaded.numPages });
        setPdf(loaded);
      }
    }).catch((err: unknown) => {
      if (!cancelled) { setError(err instanceof Error ? err.message : "Could not open PDF"); setIsLoading(false); }
    });
    return () => { cancelled = true; if (task) void task.destroy(); };
  }, [source, retry]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setIsLoading(true);
    setError(null);
    void pdf.getPage(page).then(async (pg) => {
      if (cancelled) return;
      const natural = pg.getViewport({ scale: 1 });
      onPageSizeRef.current?.({ width: natural.width, height: natural.height });
      if (scale === null) return; // Wait for the preview's measured fit before its first render.
      const viewport = pg.getViewport({ scale });
      if (onFieldsRef.current) {
        // Field detection must not prevent an otherwise valid PDF from rendering.
        try {
          const [annotations, text, operators] = await Promise.all([pg.getAnnotations(), pg.getTextContent(), pg.getOperatorList()]);
          const styles: Record<string, { fontName?: string; fontFamily?: string; bold?: boolean; italic?: boolean }> = { ...text.styles };
          for (const item of text.items) {
            if (!("str" in item)) continue;
            try {
              const font = pg.commonObjs.get(item.fontName) as { name?: string; fallbackName?: string; bold?: boolean; italic?: boolean };
              styles[item.fontName] = { ...styles[item.fontName], fontName: font.name, fontFamily: font.fallbackName || styles[item.fontName]?.fontFamily, bold: font.bold, italic: font.italic };
            } catch { /* Nearby text styles still provide a family fallback. */ }
          }
          if (!cancelled) onFieldsRef.current(detectPdfFields(annotations, text.items.filter((item) => "str" in item), operators, OPS, viewport, scale, styles));
        } catch { if (!cancelled) onFieldsRef.current([]); }
      }
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.ceil(viewport.width * pixelRatio);
      offscreen.height = Math.ceil(viewport.height * pixelRatio);
      const context = offscreen.getContext("2d");
      if (!context) throw new Error("Could not render PDF");
      renderTask = pg.render({ canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await renderTask.promise;
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
      onSizeRef.current?.({ width: viewport.width, height: viewport.height });
      setIsLoading(false);
    }).catch((err: unknown) => {
      if (!cancelled) { setError(err instanceof Error ? err.message : "Could not render PDF"); setIsLoading(false); }
    });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, page, scale]);

  return (
    <div className={preview ? "relative w-fit" : "relative min-h-[280px] w-full overflow-auto"}>
      <canvas ref={canvasRef} className="block max-w-none bg-white" role="img" aria-label={t("PDF page {page}", { page })} />
      {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-background/70"><LoadingSpinner text={t("Loading PDF...")} /></div>}
      {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center">
        <p className="text-red-600">{t(error)}</p>
        <button onClick={() => setRetry((value) => value + 1)} className="rounded-md border px-4 py-2">{t("Retry")}</button>
      </div>}
    </div>
  );
}

export default function PdfViewer({ onSize, onMeta, onFields, page = 1, scale = 1.2 }: {
  onSize?: (size: Size) => void;
  onMeta?: (meta: { numPages: number }) => void;
  onFields?: (fields: DetectedField[]) => void;
  page?: number; scale?: number;
}) {
  const { file } = useUpload();
  return <PdfCanvas source={file} page={page} scale={scale} onSize={onSize} onMeta={onMeta} onFields={onFields} />;
}

// A canvas preview also works on phones whose browsers cannot display blob PDFs in iframes.
export function PdfDocumentPreview({ blob }: { blob: Blob }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [sizes, setSizes] = useState<Record<number, Size>>({});
  const [viewport, setViewport] = useState<Size | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const size = sizes[page];
  const fitted = size && viewport ? fitPreviewPage(size, viewport) : null;
  const scale = zoom ?? fitted;
  const fitPage = () => {
    setZoom(null);
    scroller.current?.scrollTo(0, 0);
  };
  const changePage = (direction: number) => {
    setPage((value) => Math.max(1, Math.min(total, value + direction)));
    fitPage();
  };
  return <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
    <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-2 bg-background">
      <button className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => changePage(-1)} disabled={page <= 1}>{t("Previous")}</button>
      <span className="text-sm">{t("Page")}{" "}{page}{" "}{t("of")}{" "}{total}</span>
      <button className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => changePage(1)} disabled={page >= total}>{t("Next")}</button>
      <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={scale === null} aria-label={t("Zoom preview out")} onClick={() => setZoom(Math.max(0.001, (scale ?? 1) / 1.25))}>−</button>
      <button className="rounded border px-3 py-2" aria-label={t("Fit whole preview page")} onClick={fitPage}>{t("Fit page")}</button>
      <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={scale === null} aria-label={t("Zoom preview in")} onClick={() => setZoom(Math.min(4, (scale ?? 1) * 1.25))}>+</button>
    </div>
    <div ref={scroller} aria-label={t("Scrollable PDF preview")} className="relative isolate z-0 min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded border bg-foreground/5 p-3">
      <div className="mx-auto w-fit">
        <PdfCanvas preview source={blob} page={page} scale={scale} onMeta={({ numPages }) => setTotal(numPages)}
          onPageSize={(next) => setSizes((current) => current[page]?.width === next.width && current[page]?.height === next.height ? current : { ...current, [page]: next })} />
      </div>
    </div>
  </div>;
}
