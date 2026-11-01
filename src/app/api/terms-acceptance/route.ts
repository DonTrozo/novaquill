import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";
import { LEGAL_POLICY_VERSION } from "@/lib/legalVersion";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401, headers });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { termsAcceptedVersion: true, termsAcceptedAt: true } });
    if (!user) return new Response("Unauthorized", { status: 401, headers });
    return Response.json({ currentVersion: LEGAL_POLICY_VERSION, accepted: user.termsAcceptedVersion === LEGAL_POLICY_VERSION && !!user.termsAcceptedAt }, { headers });
  } catch {
    return new Response("Could not check terms acceptance. Please retry.", { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403, headers });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401, headers });
  if (!(await rateLimitOk(`terms:accept:${session.user.id}`, 10, 60_000))) return new Response("Rate limit", { status: 429, headers });
  let body: unknown;
  try { body = await readLimitedJson(request, 1024); }
  catch (error) { return new Response("Invalid request", { status: error instanceof RequestBodyError ? error.status : 400, headers }); }
  const input = body as { acceptTerms?: unknown; termsVersion?: unknown } | null;
  if (input?.acceptTerms !== true || input.termsVersion !== LEGAL_POLICY_VERSION) {
    return new Response("Review the current terms before accepting.", { status: 409, headers });
  }
  try {
    // The session supplies identity and the server supplies time. Replays preserve first acceptance.
    await prisma.user.updateMany({
      where: { id: session.user.id, OR: [{ termsAcceptedVersion: null }, { termsAcceptedVersion: { not: LEGAL_POLICY_VERSION } }] },
      data: { termsAcceptedVersion: LEGAL_POLICY_VERSION, termsAcceptedAt: new Date() },
    });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { termsAcceptedVersion: true, termsAcceptedAt: true } });
    if (!user) return new Response("Unauthorized", { status: 401, headers });
    if (user.termsAcceptedVersion !== LEGAL_POLICY_VERSION || !user.termsAcceptedAt) throw new Error("Unconfirmed");
    return Response.json({ accepted: true, currentVersion: LEGAL_POLICY_VERSION }, { headers });
  } catch {
    return new Response("Acceptance was not confirmed. Please retry.", { status: 503, headers });
  }
}
