import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { checkStorage } from "@/lib/storage";

async function probe(fn: () => Promise<unknown>) {
  try {
    await fn();
    return "ok";
  } catch (err) {
    logger.warn({ err }, "health probe gagal");
    return "error";
  }
}

export async function GET() {
  const [database, cache, storage] = await Promise.all([
    probe(() => prisma.$queryRaw`SELECT 1`),
    probe(async () => {
      if (redis.status === "wait") await redis.connect();
      await redis.ping();
    }),
    probe(checkStorage),
  ]);
  const ok = [database, cache, storage].every((s) => s === "ok");
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks: { database, redis: cache, storage } },
    { status: ok ? 200 : 503 },
  );
}
