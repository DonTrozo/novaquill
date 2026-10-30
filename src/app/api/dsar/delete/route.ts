import { decryptBuffer } from "@/lib/crypto";
import { cancelPayfastSubscription } from "@/lib/payfastSubscriptions";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFileAbsolute } from "@/lib/storage";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.subscription === "PRO" && user.payfastLastPaymentId && !user.payfastSubscriptionToken && !user.subscriptionCancelledAt) return Response.json({ error: "This older payment mandate needs cancellation before account cleanup. Submit a billing request so we can resolve both together.", help: "/billing" }, { status: 409 });
  if (!(await rateLimitOk(`account:delete:${user.id}`, 5, 60_000))) return new Response("Rate limit", { status: 429 });
  try {
    await prisma.$transaction(async (tx) => {
      // Serialize against document FK inserts so concurrent uploads cannot escape deletion.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const locked = await tx.user.findUnique({ where: { id: user.id } });
      if (locked?.payfastSubscriptionToken && !locked.subscriptionCancelledAt) {
        await cancelPayfastSubscription(decryptBuffer(Buffer.from(locked.payfastSubscriptionToken), true).toString("utf8"));
      }
      const docs = await tx.document.findMany({ where: { userId: user.id } });
      for (const d of docs) await deleteFileAbsolute(d.path);
      // Keep only records under an expressly recorded legal/incident hold, detached from the account.
      await tx.privacyRequest.updateMany({ where: { userId: user.id, retentionHold: true }, data: { userId: null } });
      await tx.securityEvent.deleteMany({ where: { actorId: user.id, retentionHold: false } });
      // Existing cascades remove documents, signatures, requests, accounts and sessions together.
      await tx.user.delete({ where: { id: user.id } });
      await tx.securityEvent.create({ data: { action: "account.deleted", actorId: null } });
    }, { timeout: 60_000 });
  } catch { return new Response("Could not finish deletion. Your account remains available so you can retry.", { status: 503 }); }
  return new Response(null, { status: 204, headers: { "Clear-Site-Data": '"cache", "cookies", "storage"' } });
}



