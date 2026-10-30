"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();
  const previousAccount = useRef<string | null>(null);
  const [file, updateFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [ready, setReady] = useState(false);
  const selectedFileRef = useRef(false);
  useEffect(() => {
    if (status === "loading") return;
    const current = session?.user?.id ?? null;
    if (previousAccount.current && previousAccount.current !== current) {
      // Signing in preserves the anonymous draft; signing out or changing accounts clears it.
      selectedFileRef.current = true;
      updateFile(null); setDraft(null);
      void clearSigningDraft().catch(() => {});
    }
    previousAccount.current = current;
  }, [session?.user?.id, status]);
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    void loadSigningDraft(session?.user?.id ?? null).then((saved) => {
      if (cancelled || !saved || selectedFileRef.current) return;
      updateFile(saved.file); setDraft(saved.editor);
    }).catch(() => {}).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [session?.user?.id, status]);
  const setFile = (next: File | null) => {
    selectedFileRef.current = true;
    updateFile(next); setDraft(null);
    void clearSigningDraft().catch(() => {});
  };
  const preserveDraft = async (editor: EditorDraft) => {
    if (!file) throw new Error("No document to preserve.");
    await saveSigningDraft(file, editor, session?.user?.id ?? null);
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
