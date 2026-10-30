import { recordSecurityEvent } from "@/lib/securityAudit";
import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import {
  decryptSignatureDataUrl,
  encryptSignatureDataUrl,
  hashSignatureDataUrl,
  validateSignatureDataUrl,
} from "@/lib/signatureStorage";

const MAX_SIGNATURES_PER_USER = 12;
const MAX_NAME_LENGTH = 80;

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function GET(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await prisma.savedSignature.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_SIGNATURES_PER_USER,
    select: { id: true, name: true, encryptedPayload: true, createdAt: true },
  });

  const signatures = rows.map((row) => ({
    id: row.id,
    name: row.name,
    dataUrl: decryptSignatureDataUrl(Buffer.from(row.encryptedPayload)),
    createdAt: row.createdAt.toISOString(),
  }));

  await recordSecurityEvent("signature.listed", user.id);
  return new Response(JSON.stringify({ signatures }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local")
    .split(",")[0]!
    .trim();
  if (!(await rateLimitOk(`sig:create:user:${user.id}`, 40, 60_000))) return new Response("Rate limit", { status: 429 });
  if (!(await rateLimitOk(`sig:create:ip:${ip}`, 120, 60_000))) return new Response("Rate limit", { status: 429 });

  let body: { name?: unknown; dataUrl?: unknown; saveForFuture?: unknown } | null;
  try { body = await readLimitedJson(request, 3 * 1024 * 1024 + 1024) as typeof body; }
  catch (error) { return new Response("Invalid signature request", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  if (typeof body?.dataUrl !== "string") return new Response("Bad Request", { status: 400 });

  if (body.saveForFuture !== true) return new Response("Explicit signature storage choice required", { status: 400 });
  if (body.name !== undefined && typeof body.name !== "string") return new Response("Invalid name", { status: 400 });

  const validation = validateSignatureDataUrl(body.dataUrl);
  if (!validation.ok) {
    return new Response(validation.error, { status: 400 });
  }

  const existingCount = await prisma.savedSignature.count({ where: { userId: user.id } });
  const hash = hashSignatureDataUrl(body.dataUrl);

  const existing = await prisma.savedSignature.findUnique({
    where: { userId_hash: { userId: user.id, hash } },
    select: { id: true, name: true, encryptedPayload: true, createdAt: true },
  });

  if (existing) {
    await recordSecurityEvent("signature.saved.explicit-v1", user.id, existing.id);
    return new Response(
      JSON.stringify({
        signature: {
          id: existing.id,
          name: existing.name,
          dataUrl: decryptSignatureDataUrl(Buffer.from(existing.encryptedPayload)),
          createdAt: existing.createdAt.toISOString(),
        },
        duplicate: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (existingCount >= MAX_SIGNATURES_PER_USER) {
    return new Response(`Maximum ${MAX_SIGNATURES_PER_USER} signatures allowed`, { status: 409 });
  }

  const trimmedName = (typeof body.name === "string" ? body.name.trim() : "") || "";
  const safeName = (trimmedName || `Signature ${existingCount + 1}`).slice(0, MAX_NAME_LENGTH);

  const created = await prisma.savedSignature.create({
    data: {
      userId: user.id,
      name: safeName,
      mimeType: "image/png",
      encryptedPayload: encryptSignatureDataUrl(body.dataUrl),
      hash,
    },
    select: { id: true, name: true, encryptedPayload: true, createdAt: true },
  });

  await recordSecurityEvent("signature.saved.explicit-v1", user.id, created.id);
  return new Response(
    JSON.stringify({
      signature: {
        id: created.id,
        name: created.name,
        dataUrl: decryptSignatureDataUrl(Buffer.from(created.encryptedPayload)),
        createdAt: created.createdAt.toISOString(),
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local")
    .split(",")[0]!
    .trim();
  if (!(await rateLimitOk(`sig:delete:user:${user.id}`, 40, 60_000))) return new Response("Rate limit", { status: 429 });
  if (!(await rateLimitOk(`sig:delete:ip:${ip}`, 120, 60_000))) return new Response("Rate limit", { status: 429 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing signature id", { status: 400 });

  const signature = await prisma.savedSignature.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!signature) return new Response("Not found", { status: 404 });
  if (signature.userId !== user.id) {
    await recordSecurityEvent("signature.denied", user.id, id);
    return new Response("Forbidden", { status: 403 });
  }

  await prisma.savedSignature.delete({ where: { id } });
  await recordSecurityEvent("signature.deleted", user.id, id);
  return new Response(null, { status: 204 });
}
