import { recordSecurityEvent } from "@/lib/securityAudit";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readFileAbsolute, deleteFileAbsolute } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (doc.userId !== user.id) {
    await recordSecurityEvent("document.denied", user.id, id);
    return new Response("Forbidden", { status: 403 });
  }
  if (!(await rateLimitOk(`doc:read:${user.id}`, 120, 60_000))) return new Response("Rate limit", { status: 429 });
  const data = await readFileAbsolute(doc.path);
  const downloadName = encodeURIComponent(doc.filename.replace(/[\r\n\x00-\x1f\x7f]/g, "").slice(0, 255) || "signed.pdf").replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16)}`);
  await recordSecurityEvent("document.read", user.id, doc.id);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { "Content-Type": doc.mimeType, "Content-Disposition": `attachment; filename="signed.pdf"; filename*=UTF-8''${downloadName}` },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (doc.userId !== user.id) {
    await recordSecurityEvent("document.denied", user.id, id);
    return new Response("Forbidden", { status: 403 });
  }
  if (!(await rateLimitOk(`doc:delete:${user.id}`, 30, 60_000))) return new Response("Rate limit", { status: 429 });
  try { await deleteFileAbsolute(doc.path); }
  catch { return new Response("Could not delete stored document. Please try again.", { status: 503 }); }
  await prisma.document.delete({ where: { id } });
  await recordSecurityEvent("document.deleted", user.id, id);
  return new Response(null, { status: 204 });
}


