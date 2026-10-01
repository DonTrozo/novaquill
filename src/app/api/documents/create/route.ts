import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveUserPdf } from "@/lib/storage";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (user.subscription !== "PRO") return Response.json({ error: "Cloud storage requires Pro. Local signing and downloads are free and unlimited." }, { status: 402 });

  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0]!.trim();
  if (!(await rateLimitOk(`doccreate:user:${user.id}`, 30, 60_000))) return new Response("Rate limit", { status: 429 });
  if (!(await rateLimitOk(`doccreate:ip:${ip}`, 120, 60_000))) return new Response("Rate limit", { status: 429 });

  const formData = await request.formData();
  const file = formData.get("file");
  const filename = String(formData.get("filename") || "signed.pdf");
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
  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      filename,
      mimeType: "application/pdf",
      size: saved.size,
      path: saved.absPath,
    },
  });
  return new Response(JSON.stringify({ id: doc.id }), { status: 201 });
}


