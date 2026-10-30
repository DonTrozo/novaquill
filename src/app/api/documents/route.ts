import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });
  const docs = await prisma.document.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, filename: true, mimeType: true, size: true, createdAt: true } });
  return new Response(JSON.stringify(docs), { status: 200 });
}


