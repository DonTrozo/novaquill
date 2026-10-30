import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptBuffer } from "@/lib/crypto";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";
import { recordSecurityEvent } from "@/lib/securityAudit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  const requests = await prisma.privacyRequest.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, kind: true, status: true, createdAt: true, resolvedAt: true, notifiedAt: true },
  });
  return Response.json({ requests });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  if (session?.user?.id && !user) return new Response("Unauthorized", { status: 401 });
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0]!.trim();
  if (!(await rateLimitOk(user ? `privacy:request:${user.id}` : `privacy:public:${ip}`, user ? 10 : 5, user ? 60_000 : 3_600_000))) return new Response("Rate limit", { status: 429 });
  let body: { kind?: unknown; message?: unknown; contactEmail?: unknown; website?: unknown } | null;
  try { body = await readLimitedJson(request, 20_000) as typeof body; }
  catch (error) { return new Response("Invalid request", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  if (!body || typeof body.kind !== "string" || !["ACCESS", "CORRECTION", "OBJECTION", "DELETION"].includes(body.kind) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000 || body.website) return new Response("Invalid request", { status: 400 });
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";
  if ((!user || contactEmail) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 254)) return new Response("Contact email required", { status: 400 });
  const receipt = await prisma.privacyRequest.create({
    data: { userId: user?.id ?? null, encryptedContact: contactEmail ? encryptBuffer(Buffer.from(contactEmail, "utf8")) : null, kind: body.kind, encryptedMessage: encryptBuffer(Buffer.from(body.message.trim(), "utf8")) },
    select: { id: true, kind: true, status: true, createdAt: true },
  });
  await recordSecurityEvent("privacy.requested", user?.id ?? null, receipt.id);
  return Response.json({ request: receipt }, { status: 201 });
}
