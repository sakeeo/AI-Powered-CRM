"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { WA_PROVIDER_INFO } from "@/modules/whatsapp/constants";
import { testGateway, type WaConfig } from "@/modules/whatsapp/gateway";
import { saveWaConnectorSchema, waProviderSchema } from "@/modules/whatsapp/schemas";

const aad = (organizationId: string, type: string) => `${organizationId}:${type}`;
const newSecret = () => `wasec_${randomBytes(32).toString("base64url")}`;

type StoredConfig = { token: string; apiUrl?: string; webhookSecret: string };

/**
 * Simpan connector WhatsApp. Token & secret webhook dienkripsi (AES-GCM, AAD tenant+tipe).
 * `webhookSecret` hanya dikembalikan SEKALI saat connector pertama dibuat atau diputar ulang.
 */
export const saveWhatsappConnector = tenantAction(saveWaConnectorSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const info = WA_PROVIDER_INFO[input.provider];
  const existing = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  const old = existing
    ? (JSON.parse(
        decryptSecret(existing.configEncrypted, aad(ctx.organizationId, info.type)),
      ) as StoredConfig)
    : null;
  const token = input.token || old?.token;
  if (!token) throw new AppError("Token gateway wajib diisi");
  let apiUrl: string | undefined;
  if (input.provider === "http") {
    try {
      apiUrl = (await assertPublicHttpsUrl(input.apiUrl)).toString();
    } catch (e) {
      throw new AppError((e as Error).message);
    }
  }
  const webhookSecret = old?.webhookSecret ?? newSecret();
  const publicId =
    (existing?.settings as { publicId?: string } | null)?.publicId ??
    randomBytes(18).toString("base64url");
  const config: StoredConfig = { token, apiUrl, webhookSecret };
  const hasDefault = await ctx.db.tenantConnector.count({
    where: { type: { startsWith: "whatsapp_" }, isDefault: true },
  });
  const data = {
    configEncrypted: encryptSecret(JSON.stringify(config), aad(ctx.organizationId, info.type)),
    maskedHint: maskSecret(token),
    settings: { publicId, ...(apiUrl ? { apiUrl } : {}) },
    status: "active",
    lastTestOk: null,
    lastTestError: null,
  };
  if (existing) {
    await ctx.db.tenantConnector.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: ctx.userId } as never,
    });
  } else {
    await ctx.db.tenantConnector.create({
      data: {
        ...data,
        type: info.type,
        isDefault: hasDefault === 0,
        createdBy: ctx.userId,
      } as never,
    });
  }
  await writeAudit(ctx, {
    action: existing ? "connector.updated" : "connector.created",
    entityType: "Connector",
    entityId: info.type,
    after: { maskedHint: data.maskedHint },
  });
  revalidatePath("/settings/connectors");
  return { publicId, webhookSecret: existing ? undefined : webhookSecret };
});

export const testWhatsappConnector = tenantAction(waProviderSchema, async (ctx, { provider }) => {
  assertCan(ctx, "update", "Connector");
  const info = WA_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector belum dikonfigurasi", 404, "not_found");
  const cfg = JSON.parse(
    decryptSecret(row.configEncrypted, aad(ctx.organizationId, info.type)),
  ) as StoredConfig;
  const waCfg: WaConfig = { provider, token: cfg.token, apiUrl: cfg.apiUrl };
  const result = await testGateway(waCfg);
  const error = result.ok ? null : result.error.split(cfg.token).join("[REDACTED]");
  await ctx.db.tenantConnector.update({
    where: { id: row.id },
    data: {
      lastTestedAt: new Date(),
      lastTestOk: result.ok,
      lastTestError: error,
      status: result.ok ? "active" : "error",
    },
  });
  await writeAudit(ctx, {
    action: "connector.tested",
    entityType: "Connector",
    entityId: info.type,
    after: { ok: result.ok },
  });
  revalidatePath("/settings/connectors");
  return result.ok ? ({ ok: true } as const) : ({ ok: false, error: error! } as const);
});

/** Putar ulang secret webhook (yang lama langsung tidak berlaku). Tampil sekali. */
export const rotateWhatsappSecret = tenantAction(waProviderSchema, async (ctx, { provider }) => {
  assertCan(ctx, "update", "Connector");
  const info = WA_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
  const cfg = JSON.parse(
    decryptSecret(row.configEncrypted, aad(ctx.organizationId, info.type)),
  ) as StoredConfig;
  const webhookSecret = newSecret();
  await ctx.db.tenantConnector.update({
    where: { id: row.id },
    data: {
      configEncrypted: encryptSecret(
        JSON.stringify({ ...cfg, webhookSecret }),
        aad(ctx.organizationId, info.type),
      ),
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "connector.secret_rotated",
    entityType: "Connector",
    entityId: info.type,
  });
  revalidatePath("/settings/connectors");
  return { webhookSecret };
});

export const removeWhatsappConnector = tenantAction(waProviderSchema, async (ctx, { provider }) => {
  assertCan(ctx, "delete", "Connector");
  const info = WA_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
  await ctx.db.tenantConnector.delete({ where: { id: row.id } });
  if (row.isDefault) {
    const next = await ctx.db.tenantConnector.findFirst({
      where: { type: { startsWith: "whatsapp_" } },
      orderBy: { createdAt: "asc" },
    });
    if (next)
      await ctx.db.tenantConnector.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await writeAudit(ctx, {
    action: "connector.removed",
    entityType: "Connector",
    entityId: info.type,
    before: { maskedHint: row.maskedHint },
  });
  revalidatePath("/settings/connectors");
});

export const setDefaultWhatsappConnector = tenantAction(
  waProviderSchema,
  async (ctx, { provider }) => {
    assertCan(ctx, "update", "Connector");
    const info = WA_PROVIDER_INFO[provider];
    const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
    if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
    await ctx.db.tenantConnector.updateMany({
      where: { type: { startsWith: "whatsapp_" } },
      data: { isDefault: false },
    });
    await ctx.db.tenantConnector.update({ where: { id: row.id }, data: { isDefault: true } });
    revalidatePath("/settings/connectors");
  },
);
