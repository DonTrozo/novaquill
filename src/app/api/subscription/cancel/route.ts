import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { decryptBuffer } from "@/lib/crypto";
import { cancelPayfastSubscription } from "@/lib/payfastSubscriptions";
import { paidThrough } from "@/lib/subscriptionAccess";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  if (!(await rateLimitOk(`billing:cancel:${userId}`, 5, 60_000))) return new Response("Rate limit", { status: 429 });
  try {
    // Serialises cancellation with account deletion and verified payment updates.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return { status: 401, error: "Unauthorized" };
      if (user.subscriptionCancelledAt) return { status: 200, paidThrough: paidThrough(user), cancelledAt: user.subscriptionCancelledAt };
      if (!user.payfastSubscriptionToken) return { status: 409, error: "Use the billing request form for this existing subscription.", help: "/billing" };
      await cancelPayfastSubscription(decryptBuffer(Buffer.from(user.payfastSubscriptionToken), true).toString("utf8"));
      const cancelledAt = new Date();
      const end = paidThrough(user);
      await tx.user.update({ where: { id: user.id }, data: { subscriptionCancelledAt: cancelledAt, subscriptionPaidThroughAt: end } });
      await tx.securityEvent.create({ data: { actorId: user.id, action: "subscription.cancelled" } });
      return { status: 200, paidThrough: end, cancelledAt };
    }, { timeout: 25_000 });
    return Response.json(result, { status: result.status });
  } catch { return Response.json({ error: "Cancellation could not be confirmed. Try again or use the billing request form.", help: "/billing" }, { status: 503 }); }
}
