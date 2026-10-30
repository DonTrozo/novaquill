import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptBuffer } from "@/lib/crypto";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0]!.trim();
  if (!(await rateLimitOk(`billing:request:${ip}`, 5, 3_600_000))) return new Response("Rate limit", { status: 429 });
  let body: { kind?: unknown; contactEmail?: unknown; message?: unknown; website?: unknown } | null;
  try { body = await readLimitedJson(request, 16_384) as typeof body; }
  catch (error) { return new Response("Invalid request", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  if (!body || !["CANCELLATION", "REFUND", "PAYMENT", "SECURITY"].includes(String(body.kind)) || typeof body.contactEmail !== "string" || body.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail.trim()) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000 || body.website) return new Response("Invalid request", { status: 400 });
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } }) : null;
  if (session?.user?.id && !user) return new Response("Unauthorized", { status: 401 });
  const receipt = await prisma.billingRequest.create({ data: { userId: user?.id ?? null, kind: String(body.kind), encryptedContact: encryptBuffer(Buffer.from(body.contactEmail.trim())), encryptedMessage: encryptBuffer(Buffer.from(body.message.trim())) }, select: { id: true, status: true, createdAt: true } });
  // A public claim never cancels an account. Staff must verify identity and the provider mandate.
  return Response.json({ request: receipt, completed: false }, { status: 201 });
}
