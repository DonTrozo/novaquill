import { promises as fs } from "fs";
import path from "path";
import { encryptBuffer, decryptBuffer } from "@/lib/crypto";
import {
  assertStorageConfigured,
  deleteCloudinaryRaw,
  isCloudinaryEnabled,
  makeCloudinaryPublicId,
  readCloudinaryRaw,
  uploadCloudinaryRaw,
} from "@/lib/cloudinary";

const BASE_DIR = path.join(process.cwd(), "storage", "documents");

export async function ensureUserDir(userId: string): Promise<string> {
  const dir = path.join(BASE_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveUserPdf(
  userId: string,
  filename: string,
  data: ArrayBuffer
): Promise<{ relPath: string; absPath: string; size: number }> {
  assertStorageConfigured();

  const buffer = Buffer.from(data);
  const encrypted = encryptBuffer(buffer);

  if (isCloudinaryEnabled()) {
    const publicId = makeCloudinaryPublicId(userId, filename);
    const storagePath = await uploadCloudinaryRaw(publicId, encrypted);
    return { relPath: storagePath, absPath: storagePath, size: buffer.byteLength };
  }

  const dir = await ensureUserDir(userId);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const target = path.join(dir, `${Date.now()}_${safeName || "document"}.pdf`);
  await fs.writeFile(target, encrypted);
  const relPath = path.relative(process.cwd(), target);
  return { relPath, absPath: target, size: buffer.byteLength };
}

export async function readFileAbsolute(absPath: string): Promise<Buffer> {
  if (absPath.startsWith("cloudinary:")) {
    const payload = await readCloudinaryRaw(absPath);
    return decryptBuffer(payload, absPath.startsWith("cloudinary:authenticated:"));
  }

  const payload = await fs.readFile(absPath);
  return decryptBuffer(payload);
}

export async function deleteFileAbsolute(absPath: string): Promise<void> {
  try {
    if (absPath.startsWith("cloudinary:")) {
      await deleteCloudinaryRaw(absPath);
      return;
    }

    await fs.unlink(absPath);
  } catch (error) {
    // A missing local file is already deleted; every other failure must remain retryable.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
