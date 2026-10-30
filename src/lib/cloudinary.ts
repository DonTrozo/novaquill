import { randomUUID } from "crypto";
import { v2 as cloudinary } from "cloudinary";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let configured = false;

function configure(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: required("CLOUDINARY_CLOUD_NAME"),
    api_key: required("CLOUDINARY_API_KEY"),
    api_secret: required("CLOUDINARY_API_SECRET"),
    secure: true,
  });
  configured = true;
}

export function isCloudinaryEnabled(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function assertStorageConfigured(): void {
  if (process.env.NODE_ENV === "production" && !isCloudinaryEnabled()) {
    throw new Error("Cloudinary storage must be configured in production");
  }
}

export function makeCloudinaryPublicId(userId: string, _filename: string): string {
  void _filename; // Filenames may contain personal information; never put them in provider object keys.
  return `novaquill/documents/${userId}/${randomUUID()}.bin`;
}

export async function uploadCloudinaryRaw(publicId: string, body: Buffer): Promise<string> {
  configure();
  const dataUri = `data:application/octet-stream;base64,${body.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: "raw",
    type: "authenticated",
    overwrite: false,
    unique_filename: false,
  });
  return `cloudinary:authenticated:${result.public_id}`;
}

export async function readCloudinaryRaw(storagePath: string): Promise<Buffer> {
  configure();
  const authenticated = storagePath.startsWith("cloudinary:authenticated:");
  const publicId = storagePath.replace(/^cloudinary:(authenticated:)?/, "");
  // Keep old encrypted uploads readable; only new uploads use authenticated delivery.
  const url = authenticated ? cloudinary.utils.private_download_url(publicId, "bin", {
    resource_type: "raw", type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
  }) : (await cloudinary.api.resource(publicId, { resource_type: "raw" })).secure_url;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Invalid stored document URL");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to read Cloudinary document: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteCloudinaryRaw(storagePath: string): Promise<void> {
  configure();
  const authenticated = storagePath.startsWith("cloudinary:authenticated:");
  const publicId = storagePath.replace(/^cloudinary:(authenticated:)?/, "");
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw", type: authenticated ? "authenticated" : "upload", invalidate: true,
  });
  if (result.result !== "ok" && result.result !== "not found") throw new Error("Stored document deletion failed");
}
