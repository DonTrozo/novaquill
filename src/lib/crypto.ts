import crypto from "crypto";

function getKey(): Buffer {
  const b64 = process.env.STORAGE_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("STORAGE_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("STORAGE_ENCRYPTION_KEY must be 32 bytes (base64 for AES-256-GCM)");
  }
  return key;
}

export function encryptBuffer(plaintext: Buffer): Buffer {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [ 'NG1' 3 bytes magic ][iv(12)][tag(16)][ciphertext]
  return Buffer.concat([Buffer.from("NG1"), iv, tag, enc]);
}

export function decryptBuffer(payload: Buffer, requireEncrypted = false): Buffer {
  if (payload.slice(0, 3).toString() !== "NG1") {
    if (requireEncrypted) throw new Error("Encrypted payload is invalid");
    // Compatibility for legacy documents; new authenticated storage requires encryption.
    return payload;
  }
  if (payload.length < 31) throw new Error("Encrypted payload is truncated");
  const key = getKey();
  const iv = payload.slice(3, 15);
  const tag = payload.slice(15, 31);
  const data = payload.slice(31);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}



