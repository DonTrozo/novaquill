import type { InkStroke } from "./documentInk";
import type { TextElement } from "../components/DocumentFillLayer";

export type EditorDraft = {
  sigDataUrl: string | null;
  signaturePage: number;
  signaturePlaced: boolean;
  pos: { x: number; y: number };
  signatureSize: { width: number; height: number };
  signatureRotation: number;
  page: number;
  scale: number;
  inkStrokes: InkStroke[];
  textElements: TextElement[];
  pdfPageSizes: Record<number, { width: number; height: number }>;
};

type SavedDraft = { file: File; editor: EditorDraft; savedAt: number };
const MAX_AGE = 24 * 60 * 60 * 1000;

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("novaquill-signing", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not preserve your document for sign-in. Please allow browser storage and try again."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      const request = action(tx.objectStore("drafts"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error("Could not preserve your document for sign-in. Please allow browser storage and try again."));
    });
  } finally { db.close(); }
}

export async function saveSigningDraft(file: File, editor: EditorDraft) {
  await transaction("readwrite", (store) => store.put({ file, editor, savedAt: Date.now() } satisfies SavedDraft, "current"));
}

export async function clearSigningDraft() {
  await transaction("readwrite", (store) => store.delete("current"));
}

export async function loadSigningDraft(): Promise<SavedDraft | null> {
  const draft = await transaction<SavedDraft | undefined>("readonly", (store) => store.get("current"));
  if (!draft) return null;
  if (Date.now() - draft.savedAt > MAX_AGE) { await clearSigningDraft(); return null; }
  return draft;
}
