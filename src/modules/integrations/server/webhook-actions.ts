"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { encryptSecret } from "@/lib/crypto";
import { AppError, NotFoundError } from "@/lib/errors";
import { deliverOutbound, enqueueDelivery } from "@/lib/outbound-webhooks";
import { idInput } from "@/lib/schema-helpers";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { MAX_OUTBOUND_WEBHOOKS } from "@/modules/integrations/constants";
import { createOutboundSchema, updateOutboundSchema } from "@/modules/integrations/schemas";

const aad = (organizationId: string) => `${organizationId}:outbound_webhook`;
const newSecret = () => `crmsec_${randomBytes(32).toString("base64url")}`;
const hint = (s: string) => `crmsec_...${s.slice(-4)}`;

async function checkUrl(url: string) {
  try {
    return (await assertPublicHttpsUrl(url)).toString();
  } catch (e) {
    throw new AppError((e as Error).message);
  }
}

/** Buat endpoint webhook keluar. Secret penandatangan dikembalikan SEKALI. */
export const createOutboundWebhook = tenantAction(createOutboundSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  if ((await ctx.db.outboundWebhook.count()) >= MAX_OUTBOUND_WEBHOOKS)
    throw new AppError(`Maksimal ${MAX_OUTBOUND_WEBHOOKS} webhook keluar`);
  const url = await checkUrl(input.url);
  const secret = newSecret();
  const row = await ctx.db.outboundWebhook.create({
    data: {
      name: input.name,
      provider: input.provider,
      url,
      events: input.events,
      secretEncrypted: encryptSecret(secret, aad(ctx.organizationId)),
      maskedHint: hint(secret),
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "outbound_webhook.created",
    entityType: "Connector",
    entityId: row.id,
    after: { name: input.name, provider: input.provider, events: input.events },
  });
  revalidatePath("/settings/connectors");
  return { id: row.id, secret };
});

export const updateOutboundWebhook = tenantAction(updateOutboundSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const existing = await ctx.db.outboundWebhook.findFirst({ where: { id: input.id } });
  if (!existing) throw NotFoundError("Webhook");
  const url = await checkUrl(input.url);
  await ctx.db.outboundWebhook.update({
    where: { id: input.id },
    data: {
      name: input.name,
      url,
      events: input.events,
      isActive: input.isActive,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "outbound_webhook.updated",
    entityType: "Connector",
    entityId: input.id,
    before: { isActive: existing.isActive },
    after: { isActive: input.isActive, events: input.events },
  });
  revalidatePath("/settings/connectors");
});

export const rotateOutboundSecret = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "update", "Connector");
  const existing = await ctx.db.outboundWebhook.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Webhook");
  const secret = newSecret();
  await ctx.db.outboundWebhook.update({
    where: { id },
    data: {
      secretEncrypted: encryptSecret(secret, aad(ctx.organizationId)),
      maskedHint: hint(secret),
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "outbound_webhook.secret_rotated",
    entityType: "Connector",
    entityId: id,
  });
  revalidatePath("/settings/connectors");
  return { secret };
});

export const deleteOutboundWebhook = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "delete", "Connector");
  const existing = await ctx.db.outboundWebhook.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Webhook");
  await ctx.db.outboundWebhook.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "outbound_webhook.deleted",
    entityType: "Connector",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/settings/connectors");
});

/** Kirim event uji `ping` secara langsung (tanpa antrean) dan laporkan hasilnya. */
export const testOutboundWebhook = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "update", "Connector");
  const hook = await ctx.db.outboundWebhook.findFirst({ where: { id } });
  if (!hook) throw NotFoundError("Webhook");
  const d = await ctx.db.outboundDelivery.create({
    data: {
      webhookId: id,
      event: "ping",
      eventId: `ping:${Date.now()}`,
      payload: {
        event: "ping",
        createdAt: new Date().toISOString(),
        data: { message: "Tes dari CRM" },
      },
    } as never,
  });
  try {
    await deliverOutbound(
      { organizationId: ctx.organizationId, deliveryId: d.id },
      { final: true },
    );
  } catch {
    /* hasil dibaca dari baris delivery */
  }
  const after = await ctx.db.outboundDelivery.findFirstOrThrow({ where: { id: d.id } });
  revalidatePath("/settings/connectors");
  return after.status === "success"
    ? ({ ok: true } as const)
    : ({ ok: false, error: after.error ?? "Gagal" } as const);
});

/**
 * Kirim ulang pengiriman yang masuk dead-letter (gagal setelah semua percobaan). Aksi eksplisit pengguna dengan
 * izin kelola connector; hanya untuk status `failed` pada endpoint yang aktif. Memakai ID event yang sama,
 * jadi penerima tetap dapat membuang duplikat lewat `x-crm-delivery`/`id` payload.
 */
export const retryOutboundDelivery = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "update", "Connector");
  const d = await ctx.db.outboundDelivery.findFirst({
    where: { id },
    include: { webhook: { select: { isActive: true, name: true } } },
  });
  if (!d) throw NotFoundError("Pengiriman");
  if (d.status !== "failed")
    throw new AppError("Hanya pengiriman yang gagal yang dapat dikirim ulang");
  if (!d.webhook.isActive) throw new AppError("Aktifkan endpoint webhook terlebih dahulu");
  await ctx.db.outboundDelivery.update({
    where: { id },
    data: { status: "pending", attempts: 0, error: null, httpStatus: null },
  });
  await enqueueDelivery(ctx.organizationId, id, `r${Date.now()}`);
  await writeAudit(ctx, {
    action: "outbound_delivery.retried",
    entityType: "Connector",
    entityId: id,
    after: { event: d.event, webhook: d.webhook.name },
  });
  revalidatePath("/settings/connectors");
});
