import { prisma } from "@/lib/prisma";
import Redis from "ioredis";

export async function GET() {
  const details: Record<string, unknown> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    details.db = "ok";
  } catch {
    details.db = "error";
    return new Response(JSON.stringify({ status: "unhealthy", ...details }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      details.redis = "ok";
    } catch {
      details.redis = "error";
      return new Response(JSON.stringify({ status: "unhealthy", ...details }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    details.redis = "skipped";
  }

  return new Response(JSON.stringify({ status: "healthy", ...details }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

