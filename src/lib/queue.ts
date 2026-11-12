import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

/** BullMQ mensyaratkan `maxRetriesPerRequest: null` pada koneksi Redis (berbeda dari koneksi aplikasi biasa). */
export function createQueueConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const QUEUES = {
  mail: "mail",
  reminders: "reminders",
  automation: "automation",
  outbound: "outbound",
  calendar: "calendar",
  googleSync: "google-sync",
  insights: "insights",
} as const;

const globalForQueue = globalThis as unknown as {
  queueConn?: IORedis;
  queues?: Map<string, Queue>;
};

export function getQueue(name: string): Queue {
  globalForQueue.queueConn ??= createQueueConnection();
  globalForQueue.queues ??= new Map();
  let q = globalForQueue.queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: globalForQueue.queueConn as unknown as ConnectionOptions });
    globalForQueue.queues.set(name, q);
  }
  return q;
}

export async function closeQueues() {
  for (const q of globalForQueue.queues?.values() ?? []) await q.close();
  globalForQueue.queues?.clear();
  await globalForQueue.queueConn?.quit().catch(() => undefined);
  globalForQueue.queueConn = undefined;
}
