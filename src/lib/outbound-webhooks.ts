import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getQueue, QUEUES } from "@/lib/queue";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { forTenant } from "@/lib/tenant";
import {
  OUTBOUND_MAX_ATTEMPTS,
  OUTBOUND_SCHEMA_VERSION,
  type OutboundEvent,
} from "@/modules/integrations/constants";
import { validateEventData } from "@/modules/integrations/events";

/**
 * Webhook keluar (Zapier/Make/kustom). Alur: aksi bisnis → `emitBusinessEvent` mencatat satu
 * OutboundDelivery per endpoint (unik (webhook, eventId) → tidak ada pengiriman ganda) dan mengantre job
 * BullMQ → worker `deliverOutbound` menandatangani (HMAC-SHA256) dan POST dengan retry exponential.
 * Tujuan divalidasi ulang tiap kirim (HTTPS + IP publik) sebelum fetch.
 */

export type OutboundJob = { organizationId: string; deliveryId: string };

export function signBody(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Antre satu delivery ke BullMQ (retry exponential). `suffix` membuat jobId baru untuk kirim ulang manual. */
export async function enqueueDelivery(organizationId: string, deliveryId: string, suffix?: string) {
  await getQueue(QUEUES.outbound).add(
    "deliver",
    { organizationId, deliveryId } satisfies OutboundJob,
    {
      jobId: suffix ? `out-${deliveryId}-${suffix}` : `out-${deliveryId}`,
      attempts: OUTBOUND_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );
}

/**
 * Catat & antre event bisnis. Dipanggil setelah data tersimpan; tidak pernah melempar ke pemanggil.
 * `eventId` unik per kejadian (mis. `deal.won:<id>:<closedAt>`).
 */
export async function emitBusinessEvent(
  organizationId: string,
  event: OutboundEvent,
  eventId: string,
  data: Record<string, unknown>,
) {
  try {
    // Kontrak payload ber-versi: data yang tidak sesuai skema TIDAK dikirim (kesalahan pemrogram, bukan input pengguna).
    const valid = validateEventData(event, data);
    if (!valid.success) {
      logger.error(
        {
          event,
          issues: valid.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        "Payload webhook keluar tidak sesuai skema; tidak dikirim",
      );
      return;
    }
    const db = forTenant(prisma, organizationId);
    const hooks = await db.outboundWebhook.findMany({ where: { isActive: true } });
    for (const h of hooks) {
      if (!(Array.isArray(h.events) && (h.events as string[]).includes(event))) continue;
      let deliveryId: string;
      try {
        const d = await db.outboundDelivery.create({
          data: {
            webhookId: h.id,
            event,
            eventId,
            payload: {
              id: randomUUID(),
              event,
              schemaVersion: OUTBOUND_SCHEMA_VERSION,
              createdAt: new Date().toISOString(),
              data,
            } as unknown as Prisma.InputJsonValue,
          } as never,
        });
        deliveryId = d.id;
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") continue; // sudah tercatat
        throw e;
      }
      await enqueueDelivery(organizationId, deliveryId);
    }
  } catch (err) {
    logger.error({ err, event }, "Gagal mengantre webhook keluar");
  }
}

/** Kirim satu delivery. Melempar saat gagal agar BullMQ mengulang; `final` = percobaan terakhir. */
export async function deliverOutbound(job: OutboundJob, opts: { final?: boolean } = {}) {
  const db = forTenant(prisma, job.organizationId);
  const delivery = await db.outboundDelivery.findFirst({
    where: { id: job.deliveryId },
    include: { webhook: true },
  });
  if (!delivery || delivery.status === "success") return { sent: false };
  const hook = delivery.webhook;
  const fail = async (error: string, httpStatus?: number, terminal = false) => {
    await db.outboundDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts: { increment: 1 },
        error: error.slice(0, 300),
        httpStatus: httpStatus ?? null,
        status: terminal || opts.final ? "failed" : "pending",
      },
    });
    if (!terminal) throw new Error(error);
    return { sent: false };
  };
  if (!hook.isActive) return fail("Webhook dinonaktifkan", undefined, true);

  const secret = decryptSecret(hook.secretEncrypted, `${job.organizationId}:outbound_webhook`);
  const body = JSON.stringify(delivery.payload);
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const url = await assertPublicHttpsUrl(hook.url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "CRM-Webhook/1.0",
        "x-crm-event": delivery.event,
        "x-crm-schema-version": OUTBOUND_SCHEMA_VERSION,
        "x-crm-delivery": delivery.id,
        "x-crm-timestamp": ts,
        "x-crm-signature": `sha256=${signBody(secret, ts, body)}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!res.ok) return fail(`Endpoint menjawab HTTP ${res.status}`, res.status);
    await db.outboundDelivery.update({
      where: { id: delivery.id },
      data: { status: "success", attempts: { increment: 1 }, httpStatus: res.status, error: null },
    });
    await db.outboundWebhook.update({
      where: { id: hook.id },
      data: { lastDeliveryAt: new Date() },
    });
    return { sent: true };
  } catch (e) {
    const msg = (e as Error).message ?? "Gagal mengirim";
    // URL tidak valid/privat: terminal (mengulang tidak akan membantu).
    const terminal = /HTTPS|privat|URL tidak valid|resolve|kredensial/.test(msg);
    return fail(msg, undefined, terminal);
  }
}
