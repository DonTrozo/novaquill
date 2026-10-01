"use client";

import SigningAllowanceNotice from "@/components/SigningAllowanceNotice";

import { type ChangeEvent, type DragEvent, useState } from "react";
import { useUpload } from "@/context/UploadContext";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { checkSigningAllowance } from "@/lib/signingAllowance";
import { track } from "@/lib/track";

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["application/pdf"];
const VALID_PDF_HEADER = [0x25, 0x50, 0x44, 0x46]; // %PDF

export default function UploadPage() {
  const [file, setLocalFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { setFile } = useUpload();
  const router = useRouter();
  const { status } = useSession();
  const isAuthLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  const requestSignIn = () => {
    setError("Please sign in before uploading a PDF.");
    track("upload_signin_required");
    void signIn("google", { callbackUrl: "/upload" });
  };

  // Validate PDF by checking file header
  const validatePdfHeader = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const array = new Uint8Array(e.target?.result as ArrayBuffer);
        const isValid = VALID_PDF_HEADER.every((byte, index) => array[index] === byte);
        resolve(isValid);
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const validateFile = async (file: File): Promise<{ isValid: boolean; error?: string }> => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { isValid: false, error: "Please upload a PDF file." };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { isValid: false, error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
    }

    // Validate PDF header
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
      await checkSigningAllowance();
      const validation = await validateFile(selectedFile);
      if (!validation.isValid) {
        setError(validation.error || "Invalid file");
        setLocalFile(null);
        return;
      }
      
      setLocalFile(selectedFile);
      setFile(selectedFile);
      track("upload_select");
      router.push("/sign");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error processing file. Please try again.");
      setLocalFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  function onSelect(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;
    handleFileSelect(selectedFile);
  }

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isAuthLoading) {
      setError("Checking your sign-in status. Please try again in a moment.");
      return;
    }

    if (!isSignedIn) {
      requestSignIn();
      return;
    }
    
    const droppedFile = e.dataTransfer.files?.[0] || null;
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Upload PDF</h1>
      <div className="mb-4"><SigningAllowanceNotice /></div>
      
      <div className="rounded-lg border border-foreground/15 p-6">
        {!isSignedIn && !isAuthLoading && (
          <div className="mb-6 rounded-lg border border-foreground/10 bg-foreground/5 p-4">
            <div className="font-medium">Sign in required</div>
            <p className="mt-1 text-sm text-foreground/70">
              Sign in before uploading to use your saved signatures and account.
            </p>
            <button
              type="button"
              onClick={requestSignIn}
              className="mt-3 inline-flex items-center rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5" 
              : "border-foreground/20 hover:border-foreground/30"
          } ${!isSignedIn ? "opacity-75" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="text-4xl">📄</div>
            <div>
              <p className="text-lg font-medium">
                {dragActive ? "Drop your PDF here" : "Drag and drop your PDF here"}
              </p>
              <p className="text-sm text-foreground/70 mt-1">
                {isSignedIn ? "or click to browse files" : "sign in first to upload and start editing"}
              </p>
            </div>
            <input
              type="file"
              accept="application/pdf"
              onChange={onSelect}
              className="hidden"
              id="file-input"
              disabled={isLoading || isAuthLoading || !isSignedIn}
            />
            {isSignedIn ? (
              <label
                htmlFor="file-input"
                className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Opening editor..." : "Choose PDF File"}
              </label>
            ) : (
              <button
                type="button"
                onClick={requestSignIn}
                disabled={isAuthLoading}
                className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAuthLoading ? "Checking sign-in..." : "Sign in to upload"}
              </button>
            )}
          </div>
        </div>

        {/* File Info */}
        {file && (
          <div className="mt-6 p-4 bg-foreground/5 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📋</div>
              <div className="flex-1">
                <div className="font-medium">{file.name}</div>
                <div className="text-sm text-foreground/70">
                  Size: {formatFileSize(file.size)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* File Requirements */}
        <div className="mt-4 text-sm text-foreground/70">
          <p>Supported format: PDF only</p>
          <p>Maximum size: {MAX_FILE_SIZE / (1024 * 1024)}MB</p>
        </div>
      </div>
    </div>
  );
}
