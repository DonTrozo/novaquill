import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";
import { LEGAL_POLICY_VERSION } from "@/lib/legalVersion";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0]!.trim();
  if (!(await rateLimitOk(`register:${ip}`, 20, 60_000))) {
    return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429 });
  }

  let body: unknown;
  try { body = await readLimitedJson(request, 16_384); }
  catch (error) { return new Response("Invalid registration request", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  const { name, email, password, acceptTerms, termsVersion } = (body ?? {}) as { name?: string; email?: string; password?: string; acceptTerms?: unknown; termsVersion?: unknown };
  if (acceptTerms !== true || termsVersion !== LEGAL_POLICY_VERSION) {
    return new Response(JSON.stringify({ error: "Please review and accept the current Terms of Service." }), { status: 400 });
  }

  const emailNorm = typeof email === "string" ? normalizeEmail(email) : "";
  const passwordStr = typeof password === "string" ? password : "";
  const nameStr = typeof name === "string" ? name.trim() : "";

  if (!emailNorm || !passwordStr) {
    return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400 });
  }
  if (!emailNorm.includes("@") || emailNorm.length > 254) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
  }
  if (passwordStr.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400 });
  }

  if (passwordStr.length > 4096 || nameStr.length > 100) {
    return new Response(JSON.stringify({ error: "Invalid registration details" }), { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
  }

  const passwordHash = await hash(passwordStr, 12);
  const user = await prisma.user.create({
    data: { name: nameStr || null, email: emailNorm, passwordHash, termsAcceptedVersion: LEGAL_POLICY_VERSION, termsAcceptedAt: new Date() },
  });
  return new Response(JSON.stringify({ id: user.id, email: user.email }), { status: 201 });
}


