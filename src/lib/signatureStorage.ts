import crypto from "crypto";
import { decryptBuffer, encryptBuffer } from "@/lib/crypto";

const MAX_SIGNATURE_DATA_URL_BYTES = 3 * 1024 * 1024;

function normalizeDataUrl(value: string): string {
  return value.trim();
}

export function validateSignatureDataUrl(dataUrl: string): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeDataUrl(dataUrl);
  if (Buffer.byteLength(normalized, "utf8") > MAX_SIGNATURE_DATA_URL_BYTES) return { ok: false, error: "Signature is too large" };
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(normalized);
  if (!match || match[2]!.length % 4 !== 0) return { ok: false, error: "Invalid signature format" };
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.toString("base64") !== match[2]) return { ok: false, error: "Invalid signature format" };
  const valid = match[1] === "png"
    ? bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 8192 && bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 8192
    : bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!valid) return { ok: false, error: "Invalid signature format" };
  return { ok: true };
}

export function hashSignatureDataUrl(dataUrl: string): string {
  return crypto.createHash("sha256").update(normalizeDataUrl(dataUrl), "utf8").digest("hex");
}

export function encryptSignatureDataUrl(dataUrl: string): Buffer {
  return encryptBuffer(Buffer.from(normalizeDataUrl(dataUrl), "utf8"));
}

export function decryptSignatureDataUrl(payload: Buffer): string {
  return decryptBuffer(payload, true).toString("utf8");
}

