"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useUpload } from "@/context/UploadContext";
import { track } from "@/lib/track";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["application/pdf"];
const VALID_PDF_HEADER = [0x25, 0x50, 0x44, 0x46]; // %PDF

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();
  const { setFile } = useUpload();
  const { status } = useSession();
  const isAuthLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  const requestSignIn = () => {
    setError("Please sign in before uploading a PDF.");
    track("home_upload_signin_required");
    void signIn("google", { callbackUrl: "/" });
  };

  const validatePdfHeader = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const array = new Uint8Array(event.target?.result as ArrayBuffer);
        const isValid = VALID_PDF_HEADER.every((byte, index) => array[index] === byte);
        resolve(isValid);
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const validateFile = async (file: File): Promise<{ isValid: boolean; error?: string }> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { isValid: false, error: "Please upload a PDF file." };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { isValid: false, error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
    }

    const isValidHeader = await validatePdfHeader(file);
    if (!isValidHeader) {
      return { isValid: false, error: "Invalid PDF file. Please upload a valid PDF document." };
    }

    return { isValid: true };
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (isAuthLoading) {
      setError("Checking your sign-in status. Please try again in a moment.");
      return;
    }

    if (!isSignedIn) {
      requestSignIn();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const validation = await validateFile(selectedFile);
      if (!validation.isValid) {
        setError(validation.error || "Invalid file");
        return;
      }

      setFile(selectedFile);
      track("home_upload_select");
      router.push("/sign");
    } catch {
      setError("Error processing file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) return;
    handleFileSelect(selectedFile);
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (isAuthLoading) {
      setError("Checking your sign-in status. Please try again in a moment.");
      return;
    }

    if (!isSignedIn) {
      requestSignIn();
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0] || null;
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-6 py-20 grid gap-8">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Upload. Sign. Download. <span className="text-[color:var(--color-accent)]">Done.</span>
        </h1>
        <p className="text-lg text-foreground/80 max-w-2xl">
          Minimalist PDF signing with ShapeAssist real-time correction. No emails. No watermarks.
        </p>
        <div className="flex gap-3">
          <a href="#upload" className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition">
            Upload PDF
          </a>
          <a href="/pricing" className="inline-flex items-center rounded-md px-5 py-3 border border-foreground/20 hover:bg-foreground/5 transition">
            Upgrade to Pro
          </a>
        </div>

        <section id="upload" className="rounded-2xl border border-foreground/15 bg-background p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Upload your PDF</h2>
              <p className="mt-1 text-sm text-foreground/70">
                Select a PDF and NovaQuill opens the editor immediately. Sign-in is required for credit tracking.
              </p>
            </div>
            {!isSignedIn && !isAuthLoading && (
              <button
                type="button"
                onClick={requestSignIn}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
              >
                Sign in with Google
              </button>
            )}
          </div>

          <div
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragActive
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
                : "border-foreground/20 hover:border-foreground/35"
            } ${!isSignedIn ? "opacity-80" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="mx-auto grid max-w-xl gap-4">
              <div>
                <p className="text-xl font-medium">{dragActive ? "Drop your PDF here" : "Drop PDF here"}</p>
                <p className="mt-1 text-sm text-foreground/70">
                  {isSignedIn ? "or choose a file to start editing now" : "sign in first, then upload your PDF"}
                </p>
              </div>
              <input
                id="home-file-input"
                type="file"
                accept="application/pdf"
                onChange={onSelect}
                className="hidden"
                disabled={isLoading || isAuthLoading || !isSignedIn}
              />
              {isSignedIn ? (
                <label
                  htmlFor="home-file-input"
                  className="mx-auto inline-flex cursor-pointer items-center rounded-md px-6 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
                >
                  {isLoading ? "Opening editor..." : "Choose PDF"}
                </label>
              ) : (
                <button
                  type="button"
                  onClick={requestSignIn}
                  disabled={isAuthLoading}
                  className="mx-auto inline-flex items-center rounded-md px-6 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAuthLoading ? "Checking sign-in..." : "Sign in to upload"}
                </button>
              )}
              <p className="text-xs text-foreground/60">PDF only. Maximum size: {MAX_FILE_SIZE / (1024 * 1024)}MB.</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <div className="grid sm:grid-cols-3 gap-6 pt-10">
          <div className="rounded-lg border border-foreground/10 p-5 bg-background/60">
            <div className="font-medium mb-1">1. Upload</div>
            <div className="text-foreground/70 text-sm">Drag-and-drop or select your PDF.</div>
          </div>
          <div className="rounded-lg border border-foreground/10 p-5 bg-background/60">
            <div className="font-medium mb-1">2. Sign</div>
            <div className="text-foreground/70 text-sm">Draw, type, or upload signature with real-time smoothing.</div>
          </div>
          <div className="rounded-lg border border-foreground/10 p-5 bg-background/60">
            <div className="font-medium mb-1">3. Download</div>
            <div className="text-foreground/70 text-sm">Get a clean flattened PDF. No branding.</div>
          </div>
        </div>

        <section className="pt-6 grid gap-6">
          <h2 className="text-2xl font-semibold">Why NovaQuill</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">ShapeAssist</div>
              <div className="text-foreground/70 text-sm">Instant stroke correction after each pen lift for smooth, natural signatures.</div>
            </div>
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">Clean flattened PDFs</div>
              <div className="text-foreground/70 text-sm">No watermarks, no branding, and a simple output file you can share immediately.</div>
            </div>
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">Ultra-simple</div>
              <div className="text-foreground/70 text-sm">Upload → Sign → Download. Single signer. No emails, no clutter.</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">Free & Pro</div>
              <div className="text-foreground/70 text-sm">Free: 3 docs/month for accounts. Pro: unlimited cloud storage and signing.</div>
            </div>
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">Private by design</div>
              <div className="text-foreground/70 text-sm">Encrypted storage for signed documents and user-controlled deletion.</div>
            </div>
            <div className="rounded-lg border border-foreground/10 p-5">
              <div className="font-medium mb-1">Global pricing</div>
              <div className="text-foreground/70 text-sm">EUR pricing with local ZAR checkout via PayFast.</div>
            </div>
          </div>
        </section>

        <section className="pt-6 grid gap-4">
          <h2 className="text-2xl font-semibold">FAQ</h2>
          <details className="rounded-lg border border-foreground/10 p-4">
            <summary className="cursor-pointer font-medium">Do I need an account?</summary>
            <div className="text-foreground/70 text-sm mt-2">Yes. Sign-in is required before uploading or signing so document credits can be tracked.</div>
          </details>
          <details className="rounded-lg border border-foreground/10 p-4">
            <summary className="cursor-pointer font-medium">Are there watermarks?</summary>
            <div className="text-foreground/70 text-sm mt-2">Never. Signed PDFs are clean and branding-free.</div>
          </details>
          <details className="rounded-lg border border-foreground/10 p-4">
            <summary className="cursor-pointer font-medium">Is this a qualified digital signature?</summary>
            <div className="text-foreground/70 text-sm mt-2">No. NovaQuill creates simple electronic signatures by placing your signature image onto a PDF. Advanced or qualified signatures require a certified trust service provider.</div>
          </details>
        </section>
      </main>
    </div>
  );
}
