import { hasProAccess } from "@/lib/subscriptionAccess";
import { readLimitedFormData, RequestBodyError } from "@/lib/limitedJson";
import { createHash } from "crypto";
import { recordSecurityEvent } from "@/lib/securityAudit";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveUserPdf, deleteFileAbsolute } from "@/lib/storage";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!hasProAccess(user)) return Response.json({ error: "Cloud storage requires Pro. The Free plan includes three completed documents per month." }, { status: 402 });

  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0]!.trim();
  if (!(await rateLimitOk(`doccreate:user:${user.id}`, 30, 60_000))) return new Response("Rate limit", { status: 429 });
  if (!(await rateLimitOk(`doccreate:ip:${ip}`, 120, 60_000))) return new Response("Rate limit", { status: 429 });

  let formData: FormData;
  try { formData = await readLimitedFormData(request, MAX_UPLOAD_SIZE + 64 * 1024); }
  catch (error) { return new Response("Invalid upload", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  const file = formData.get("file");
  const filename = String(formData.get("filename") || "signed.pdf");
  if (filename.length > 255) return new Response("Filename too long", { status: 400 });
  if (!(file instanceof Blob)) return new Response("Invalid file", { status: 400 });

  if (typeof file.size === "number" && file.size > MAX_UPLOAD_SIZE) {
    return new Response("File too large", { status: 413 });
  }
  // Validate magic bytes
  const headerBuf = await file.slice(0, 4).arrayBuffer().catch(() => null);
  if (!headerBuf) return new Response("Invalid file", { status: 400 });
  const header = new Uint8Array(headerBuf);
  const okHeader = PDF_MAGIC.every((b, i) => header[i] === b);
  if (!okHeader) return new Response("Invalid PDF file", { status: 400 });

  const arrayBuf = await file.arrayBuffer();
  const saved = await saveUserPdf(user.id, filename, arrayBuf);
  let doc;
  try { doc = await prisma.document.create({
    data: {
      userId: user.id,
      filename,
      mimeType: "application/pdf",
      size: saved.size,
      path: saved.absPath,
    },
  }); } catch (error) {
    // Keep failed metadata writes from silently orphaning an encrypted uploaded object.
    try { await deleteFileAbsolute(saved.absPath); } catch { console.error("document.storage_cleanup_failed"); }
    throw error;
  }
  await recordSecurityEvent("document.stored", user.id, doc.id, createHash("sha256").update(Buffer.from(arrayBuf)).digest("hex"));
  return new Response(JSON.stringify({ id: doc.id }), { status: 201 });
}


