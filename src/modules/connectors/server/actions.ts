"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { tenantAction } from "@/lib/action";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { AI_PROVIDER_INFO } from "@/modules/connectors/registry";
import {
  connectorTypeSchema,
  listAiModelsSchema,
  saveAiConnectorSchema,
} from "@/modules/connectors/schemas";
import { assertSafeBaseUrl, fetchProviderModels } from "@/modules/connectors/server/list-models";
import { testAiConnection } from "@/modules/connectors/server/test-ai";

function requiresBaseUrl(info: { baseUrlEditable: boolean; defaultBaseUrl: string }, url?: string) {
  return info.baseUrlEditable && !info.defaultBaseUrl && !url;
}

const aad = (organizationId: string, type: string) => `${organizationId}:${type}`;

/** Simpan/ubah key AI (BYOK). Key dienkripsi; yang dikembalikan & diaudit hanya petunjuk bermasker. */
export const saveAiConnector = tenantAction(saveAiConnectorSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const info = AI_PROVIDER_INFO[input.provider];
  const existing = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!existing && !input.apiKey) throw new AppError("API key wajib diisi");

  const baseUrl = info.baseUrlEditable ? input.baseUrl || undefined : undefined;
  if (requiresBaseUrl(info, baseUrl)) throw new AppError("Base URL wajib diisi");
  if (baseUrl) await assertSafeBaseUrl(baseUrl);
  const settings = { model: input.model, ...(baseUrl ? { baseUrl } : {}) };
  if (existing) {
    const data: Record<string, unknown> = { settings, updatedBy: ctx.userId };
    if (input.apiKey) {
      data.configEncrypted = encryptSecret(
        JSON.stringify({ apiKey: input.apiKey }),
        aad(ctx.organizationId, info.type),
      );
      data.maskedHint = maskSecret(input.apiKey);
      data.status = "active";
      data.lastTestOk = null;
      data.lastTestError = null;
    }
    await ctx.db.tenantConnector.update({ where: { id: existing.id }, data });
  } else {
    const hasAi = await ctx.db.tenantConnector.count({ where: { type: { startsWith: "ai_" } } });
    await ctx.db.tenantConnector.create({
      data: {
        type: info.type,
        configEncrypted: encryptSecret(
          JSON.stringify({ apiKey: input.apiKey }),
          aad(ctx.organizationId, info.type),
        ),
        maskedHint: maskSecret(input.apiKey!),
        settings,
        isDefault: hasAi === 0,
        createdBy: ctx.userId,
      } as never,
    });
  }
  await writeAudit(ctx, {
    action: existing ? "connector.updated" : "connector.created",
    entityType: "Connector",
    entityId: info.type,
    before: existing
      ? {
          model: (existing.settings as { model?: string } | null)?.model,
          maskedHint: existing.maskedHint,
        }
      : undefined,
    after: {
      model: input.model,
      maskedHint: input.apiKey ? maskSecret(input.apiKey) : existing?.maskedHint,
    },
  });
  revalidatePath("/settings/connectors");
});

/** Test koneksi dijalankan di server dengan key tersimpan; hasil disimpan pada connector. */
export const testAiConnector = tenantAction(connectorTypeSchema, async (ctx, { provider }) => {
  assertCan(ctx, "update", "Connector");
  const info = AI_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector belum dikonfigurasi", 404, "not_found");
  const { apiKey } = JSON.parse(
    decryptSecret(row.configEncrypted, aad(ctx.organizationId, info.type)),
  ) as {
    apiKey: string;
  };
  const st = row.settings as { model?: string; baseUrl?: string } | null;
  const modelId = st?.model ?? info.defaultModel;
  const result = await testAiConnection(provider, apiKey, modelId, st?.baseUrl);
  await ctx.db.tenantConnector.update({
    where: { id: row.id },
    data: {
      lastTestedAt: new Date(),
      lastTestOk: result.ok,
      lastTestError: result.ok ? null : result.error,
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
  return result;
});

/**
 * Daftar model dari penyedia. Memakai key yang diketik user, atau key tersimpan bila kosong.
 * Hanya mengembalikan nama model — key tidak pernah dikembalikan.
 */
export const listAiModels = tenantAction(listAiModelsSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const info = AI_PROVIDER_INFO[input.provider];
  let apiKey = input.apiKey;
  let baseUrl = info.baseUrlEditable ? input.baseUrl || undefined : undefined;
  if (!apiKey) {
    const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
    if (!row) throw new AppError("Isi API key terlebih dahulu");
    apiKey = (
      JSON.parse(decryptSecret(row.configEncrypted, aad(ctx.organizationId, info.type))) as {
        apiKey: string;
      }
    ).apiKey;
    baseUrl ??= info.baseUrlEditable
      ? (row.settings as { baseUrl?: string } | null)?.baseUrl
      : undefined;
  }
  return { models: await fetchProviderModels(input.provider, apiKey, baseUrl) };
});

export const removeAiConnector = tenantAction(connectorTypeSchema, async (ctx, { provider }) => {
  assertCan(ctx, "delete", "Connector");
  const info = AI_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
  await ctx.db.tenantConnector.delete({ where: { id: row.id } });
  if (row.isDefault) {
    const next = await ctx.db.tenantConnector.findFirst({
      where: { type: { startsWith: "ai_" } },
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

export const setDefaultAiConnector = tenantAction(
  connectorTypeSchema,
  async (ctx, { provider }) => {
    assertCan(ctx, "update", "Connector");
    const info = AI_PROVIDER_INFO[provider];
    const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
    if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
    await ctx.db.tenantConnector.updateMany({
      where: { type: { startsWith: "ai_" } },
      data: { isDefault: false },
    });
    await ctx.db.tenantConnector.update({ where: { id: row.id }, data: { isDefault: true } });
    await writeAudit(ctx, {
      action: "connector.default_changed",
      entityType: "Connector",
      entityId: info.type,
    });
    revalidatePath("/settings/connectors");
  },
);
