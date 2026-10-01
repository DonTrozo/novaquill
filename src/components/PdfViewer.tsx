"use client";

import { useEffect, useRef, useState } from "react";
import { useUpload } from "@/context/UploadContext";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import LoadingSpinner from "./LoadingSpinner";

if (typeof window !== "undefined") GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Size = { width: number; height: number };

function PdfCanvas({ source, page, scale, onSize, onMeta }: {
  source: Blob | null; page: number; scale: number;
  onSize?: (size: Size) => void;
  onMeta?: (meta: { numPages: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSizeRef = useRef(onSize);
  const onMetaRef = useRef(onMeta);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => { onSizeRef.current = onSize; onMetaRef.current = onMeta; }, [onSize, onMeta]);

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
      const viewport = pg.getViewport({ scale });
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
    <div className="relative min-h-[280px] w-full overflow-auto">
      <canvas ref={canvasRef} className="block max-w-none bg-white" role="img" aria-label={`PDF page ${page}`} />
      {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-background/70"><LoadingSpinner text="Loading PDF..." /></div>}
      {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => setRetry((value) => value + 1)} className="rounded-md border px-4 py-2">Retry</button>
      </div>}
    </div>
  );
}

export default function PdfViewer({ onSize, onMeta, page = 1, scale = 1.2 }: {
  onSize?: (size: Size) => void;
  onMeta?: (meta: { numPages: number }) => void;
  page?: number; scale?: number;
}) {
  const { file } = useUpload();
  return <PdfCanvas source={file} page={page} scale={scale} onSize={onSize} onMeta={onMeta} />;
}

// A canvas preview also works on phones whose browsers cannot display blob PDFs in iframes.
export function PdfDocumentPreview({ blob }: { blob: Blob }) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(1);
  const [scale, setScale] = useState(0.8);
  return <div className="grid gap-3">
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>Previous</button>
      <span className="text-sm">Page {page} of {total}</span>
      <button className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => setPage((value) => value + 1)} disabled={page >= total}>Next</button>
      <button className="rounded border px-3 py-2" aria-label="Zoom preview out" onClick={() => setScale((value) => Math.max(0.3, value - 0.1))}>−</button>
      <button className="rounded border px-3 py-2" aria-label="Zoom preview in" onClick={() => setScale((value) => Math.min(2, value + 0.1))}>+</button>
    </div>
    <div className="h-[55vh] overflow-auto rounded border bg-white">
      <PdfCanvas source={blob} page={page} scale={scale} onMeta={({ numPages }) => setTotal(numPages)} />
    </div>
  </div>;
}
