"use client";

import { useEffect, useRef, useState } from "react";
import { useUpload } from "@/context/UploadContext";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import LoadingSpinner from "./LoadingSpinner";

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export default function PdfViewer({
  onSize,
  onMeta,
  page = 1,
  scale = 1.2,
}: {
  onSize?: (size: { width: number; height: number }) => void;
  onMeta?: (meta: { numPages: number }) => void;
  page?: number;
  scale?: number;
}) {
  const { file } = useUpload();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSizeRef = useRef(onSize);
  const onMetaRef = useRef(onMeta);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    onSizeRef.current = onSize;
    onMetaRef.current = onMeta;
  }, [onSize, onMeta]);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: NodeJS.Timeout | undefined;

    async function render() {
      if (!file) return;

      setIsLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = getDocument({ data: arrayBuffer });
        const pdf: PDFDocumentProxy = await loadingTask.promise;

        if (cancelled) return;

        onMetaRef.current?.({ numPages: pdf.numPages });

        const pg = await pdf.getPage(page);
        const viewport = pg.getViewport({ scale });
        const canvas = canvasRef.current;

        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Failed to get canvas context");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        await pg.render({
          canvasContext: context as CanvasRenderingContext2D,
          viewport,
        }).promise;

        if (!cancelled) {
          onSizeRef.current?.({ width: viewport.width, height: viewport.height });
        }

        setRetryCount(0);
      } catch (e: unknown) {
        if (cancelled) return;

        const message = e instanceof Error ? e.message : "Failed to render PDF";
        setError(message);

        if (retryCount < MAX_RETRIES && shouldRetry(e)) {
          retryTimeout = setTimeout(() => {
            if (!cancelled) {
              setRetryCount((prev) => prev + 1);
            }
          }, RETRY_DELAY * (retryCount + 1));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    function shouldRetry(error: unknown): boolean {
      if (error instanceof Error) {
        const retryableErrors = ["network error", "timeout", "temporary", "connection"];
        return retryableErrors.some((msg) => error.message.toLowerCase().includes(msg));
      }
      return false;
    }

    render();

    return () => {
      cancelled = true;
      if (typeof retryTimeout !== "undefined") {
        clearTimeout(retryTimeout);
      }
    };
  }, [file, page, scale, retryCount, retryToken]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    setRetryToken((prev) => prev + 1);
  };

  if (!file) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground/70">
        <div className="text-center">
          <div className="mb-2 text-4xl">📄</div>
          <p>No file selected. Go to Upload.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[280px] w-full overflow-auto">
      <canvas
        ref={canvasRef}
        className={`block max-w-none ${error ? "opacity-30" : "opacity-100"}`}
        role="img"
        aria-label={`PDF page ${page}`}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <LoadingSpinner text="Loading PDF..." />
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4">
          <div className="max-w-md text-center">
            <div className="mb-3 text-4xl">⚠️</div>
            <p className="mb-3 text-red-600">{error}</p>
            {retryCount < MAX_RETRIES && (
              <button
                onClick={handleRetry}
                className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-white transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            )}
            {retryCount >= MAX_RETRIES && (
              <p className="text-sm text-foreground/70">
                Max retries reached. Please try uploading the file again.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
