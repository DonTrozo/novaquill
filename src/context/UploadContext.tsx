"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { clearSigningDraft, loadSigningDraft, saveSigningDraft, type EditorDraft } from "@/lib/signingDraft";

type UploadContextValue = {
  file: File | null;
  setFile: (file: File | null) => void;
  draft: EditorDraft | null;
  ready: boolean;
  preserveDraft: (editor: EditorDraft) => Promise<void>;
};

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [file, updateFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadSigningDraft().then((saved) => {
      if (cancelled || !saved) return;
      updateFile(saved.file); setDraft(saved.editor);
    }).catch(() => {}).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  const setFile = (next: File | null) => {
    updateFile(next); setDraft(null);
    void clearSigningDraft().catch(() => {});
  };
  const preserveDraft = async (editor: EditorDraft) => {
    if (!file) throw new Error("No document to preserve.");
    await saveSigningDraft(file, editor);
    setDraft(editor);
  };
  return (
    <UploadContext.Provider value={{ file, setFile, draft, ready, preserveDraft }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
