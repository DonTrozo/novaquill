import { prisma } from "@/lib/prisma";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { FREE_DOCUMENT_LIMIT, reserveDocumentCredit, usageMonth } from "@/lib/signingQuota";

export async function GET() {
	// Lightweight rate limit for anonymous polling
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
		return new Response(JSON.stringify({ subscription: "ANON", used: 0, limit: 0 }), { status: 200 });
	}
	const user = await prisma.user.findUnique({ where: { email: session.user.email } });
	if (!user) return new Response("Not found", { status: 404 });
	const isPro = user.subscription === "PRO";
	const currentYm = usageMonth();
	const used = user.usageYearMonth === currentYm ? user.docsUsedThisMonth : 0;
	return new Response(
		JSON.stringify({ subscription: isPro ? "PRO" : "FREE", used, limit: isPro ? null : FREE_DOCUMENT_LIMIT }),
		{ status: 200 }
	);
}

export async function POST(request: Request) {
	// Enforce origin and rate limit
	if (!isAllowedOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
	const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0]!.trim();
	if (!(await rateLimitOk(`usage:ip:${ip}`, 200, 60_000))) {
		return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429 });
	}
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
		return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
	}
	const user = await prisma.user.findUnique({ where: { email: session.user.email } });
	if (!user) return new Response("Not found", { status: 404 });

	// Additional per-user rate limit to prevent repeated increments (double-clicks, retries, abuse)
	if (!(await rateLimitOk(`usage:user:${user.id}`, 30, 60_000))) {
		return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429 });
	}
	const result = await reserveDocumentCredit({
		read: () => prisma.user.findUnique({ where: { id: user.id }, select: { subscription: true, usageYearMonth: true, docsUsedThisMonth: true } }),
		compareAndSet: async (previous, month, used) => {
			const updated = await prisma.user.updateMany({
				where: { id: user.id, subscription: previous.subscription, usageYearMonth: previous.usageYearMonth, docsUsedThisMonth: previous.docsUsedThisMonth },
				data: { usageYearMonth: month, docsUsedThisMonth: used },
			});
			return updated.count === 1;
		},
	});
	return Response.json(result, { status: result.status });
}
