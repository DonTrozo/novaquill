import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasProAccess, paidThrough } from "@/lib/subscriptionAccess";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  return Response.json({ pro: hasProAccess(user), paidThrough: paidThrough(user), cancelledAt: user.subscriptionCancelledAt, canCancel: Boolean(user.payfastSubscriptionToken) && !user.subscriptionCancelledAt, needsBillingHelp: !user.payfastSubscriptionToken && user.subscription === "PRO" && !user.subscriptionCancelledAt });
}
