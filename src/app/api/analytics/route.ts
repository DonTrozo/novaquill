import { readLimitedJson, RequestBodyError } from "@/lib/limitedJson";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin, rateLimitOk } from "@/lib/guard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ALLOWED_EVENTS = new Set(["dashboard_upload_select", "signup_register", "finalize_preview", "finalize_download", "signup_login", "home_upload_select", "upgrade_pro"]);

function isAdminEmail(email: string | null | undefined): boolean {
	if (!email) return false;
	const list = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
	if (list.length === 0) return false;
	return list.includes(email.toLowerCase());
}

export async function POST(request: Request) {
	if (!isAllowedOrigin(request)) return new Response("Forbidden", { status: 403 });
	const ip = request.headers.get("x-forwarded-for") || "local";
	if (!(await rateLimitOk(`an:${ip}`, 60, 60_000))) return new Response("Rate limit", { status: 429 });
	let body: unknown;
  try { body = await readLimitedJson(request, 1024); }
  catch (error) { return new Response("Invalid event", { status: error instanceof RequestBodyError ? error.status : 400 }); }
  const name = body && typeof body === "object" && "name" in body ? body.name : undefined;
	if (typeof name !== "string" || !ALLOWED_EVENTS.has(name)) return new Response("Bad Request", { status: 400 });
	await prisma.eventCounter.upsert({
		where: { name },
		update: { count: { increment: 1 } },
		create: { name, count: 1 },
	});
	return new Response(null, { status: 204 });
}

export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!isAdminEmail(user?.email)) return new Response("Forbidden", { status: 403 });
	const rows = await prisma.eventCounter.findMany({ orderBy: { name: "asc" } });
	return new Response(JSON.stringify(rows), { status: 200 });
}


