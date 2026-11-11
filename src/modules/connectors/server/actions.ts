"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { tenantAction } from "@/lib/action";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { AI_PROVIDER_INFO } from "@/modules/connectors/registry";
import { connectorTypeSchema, saveAiConnectorSchema } from "@/modules/connectors/schemas";
import { testAiConnection } from "@/modules/connectors/server/test-ai";

const aad = (organizationId: string, type: string) => `${organizationId}:${type}`;

/** Simpan/ubah key AI (BYOK). Key dienkripsi; yang dikembalikan & diaudit hanya petunjuk bermasker. */
export const saveAiConnector = tenantAction(saveAiConnectorSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const info = AI_PROVIDER_INFO[input.provider];
  const existing = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!existing && !input.apiKey) throw new AppError("API key wajib diisi");

  const settings = { model: input.model };
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
  const modelId = (row.settings as { model?: string } | null)?.model ?? info.defaultModel;
  const result = await testAiConnection(provider, apiKey, modelId);
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
