"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { sendViaConnector, type EmailConfig } from "@/lib/email-transport";
import { AppError } from "@/lib/errors";
import {
  EMAIL_PROVIDER_INFO,
  emailProviderSchema,
  saveEmailConnectorSchema,
} from "@/modules/connectors/email";

const aad = (organizationId: string, type: string) => `${organizationId}:${type}`;

/** Simpan/ubah connector email. Rahasia dienkripsi; audit & respons hanya memuat petunjuk bermasker. */
export const saveEmailConnector = tenantAction(saveEmailConnectorSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Connector");
  const info = EMAIL_PROVIDER_INFO[input.provider];
  const existing = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  const old = existing
    ? (JSON.parse(
        decryptSecret(existing.configEncrypted, aad(ctx.organizationId, info.type)),
      ) as Record<string, string>)
    : {};

  let config: Record<string, unknown>;
  let settings: Record<string, unknown>;
  let hint: string;
  if (input.provider === "smtp") {
    const pass = input.pass || old.pass || "";
    if (input.user && !pass) throw new AppError("Password SMTP wajib diisi");
    config = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      user: input.user ?? "",
      pass,
      from: input.from,
    };
    settings = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      user: input.user ?? "",
      from: input.from,
    };
    hint = `${input.user || "anon"}@${input.host}`;
  } else {
    const apiKey = input.apiKey || old.apiKey;
    if (!apiKey) throw new AppError("API key wajib diisi");
    config = { apiKey, from: input.from };
    settings = { from: input.from };
    hint = maskSecret(apiKey);
  }

  const data = {
    configEncrypted: encryptSecret(JSON.stringify(config), aad(ctx.organizationId, info.type)),
    maskedHint: hint,
    settings,
    status: "active",
    lastTestOk: null,
    lastTestError: null,
    isDefault: true,
  };
  await ctx.db.tenantConnector.updateMany({
    where: { type: { startsWith: "email_" } },
    data: { isDefault: false },
  });
  if (existing) {
    await ctx.db.tenantConnector.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: ctx.userId } as never,
    });
  } else {
    await ctx.db.tenantConnector.create({
      data: { ...data, type: info.type, createdBy: ctx.userId } as never,
    });
  }
  await writeAudit(ctx, {
    action: existing ? "connector.updated" : "connector.created",
    entityType: "Connector",
    entityId: info.type,
    after: { maskedHint: hint, from: input.from },
  });
  revalidatePath("/settings/connectors");
});

/** Test koneksi = kirim email uji ke alamat pengguna yang sedang login (langsung, tanpa antrean). */
export const testEmailConnector = tenantAction(emailProviderSchema, async (ctx, { provider }) => {
  assertCan(ctx, "update", "Connector");
  const info = EMAIL_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector belum dikonfigurasi", 404, "not_found");
  const config = JSON.parse(decryptSecret(row.configEncrypted, aad(ctx.organizationId, info.type)));
  let result: { ok: true } | { ok: false; error: string } = { ok: true };
  try {
    await sendViaConnector({ type: info.type, config } as EmailConfig, {
      to: ctx.user.email,
      subject: "Tes email delivery CRM",
      text: "Jika Anda menerima email ini, konfigurasi email delivery sudah benar.",
    });
  } catch (err) {
    // Pesan penyedia bisa memuat host/akun; potong dan jangan sertakan rahasia.
    const msg = ((err as Error).message ?? "Gagal mengirim").slice(0, 200);
    result = {
      ok: false,
      error: msg.split(String(config.pass ?? config.apiKey ?? "\u0000")).join("[REDACTED]"),
    };
  }
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

export const removeEmailConnector = tenantAction(emailProviderSchema, async (ctx, { provider }) => {
  assertCan(ctx, "delete", "Connector");
  const info = EMAIL_PROVIDER_INFO[provider];
  const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
  if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
  await ctx.db.tenantConnector.delete({ where: { id: row.id } });
  if (row.isDefault) {
    const next = await ctx.db.tenantConnector.findFirst({
      where: { type: { startsWith: "email_" } },
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

export const setDefaultEmailConnector = tenantAction(
  emailProviderSchema,
  async (ctx, { provider }) => {
    assertCan(ctx, "update", "Connector");
    const info = EMAIL_PROVIDER_INFO[provider];
    const row = await ctx.db.tenantConnector.findFirst({ where: { type: info.type } });
    if (!row) throw new AppError("Connector tidak ditemukan", 404, "not_found");
    await ctx.db.tenantConnector.updateMany({
      where: { type: { startsWith: "email_" } },
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
