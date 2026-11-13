import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { decryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";
import { AI_PROVIDER_INFO, providerFromType, type AiProvider } from "@/modules/connectors/registry";

export function buildModel(
  provider: AiProvider,
  apiKey: string,
  modelId: string,
  baseUrl?: string,
): LanguageModel {
  const info = AI_PROVIDER_INFO[provider];
  const url = (baseUrl || info.defaultBaseUrl).replace(/\/+$/, "");
  switch (provider) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey, baseURL: url })(modelId);
    default:
      // deepseek, openrouter, custom: kompatibel dengan API OpenAI (chat completions).
      return createOpenAI({ apiKey, baseURL: url }).chat(modelId);
  }
}

export type ResolvedAi = { model: LanguageModel; provider: AiProvider; modelId: string };

/**
 * Model AI milik tenant (BYOK). Memakai connector AI default yang aktif; bila tidak ada default,
 * connector AI aktif pertama. Kunci didekripsi hanya di sini (server) dan tidak pernah dikembalikan.
 * Dipakai semua fitur Safe AI.
 */
export async function getAiModel(organizationId: string): Promise<ResolvedAi> {
  const db = forTenant(prisma, organizationId);
  const rows = await db.tenantConnector.findMany({
    where: { type: { startsWith: "ai_" }, status: { not: "disabled" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const row = rows[0];
  if (!row) {
    throw new AppError(
      "Belum ada AI connector aktif. Hubungkan API key di Settings → Connectors.",
      400,
      "ai_not_configured",
    );
  }
  const provider = providerFromType(row.type);
  if (!provider) throw new AppError("Tipe AI connector tidak dikenal", 500, "ai_bad_connector");
  const { apiKey } = JSON.parse(
    decryptSecret(row.configEncrypted, `${organizationId}:${row.type}`),
  ) as {
    apiKey: string;
  };
  const settings = row.settings as { model?: string; baseUrl?: string } | null;
  const modelId = settings?.model ?? AI_PROVIDER_INFO[provider].defaultModel;
  return { model: buildModel(provider, apiKey, modelId, settings?.baseUrl), provider, modelId };
}

/**
 * Jalankan fitur AI dan catat METADATA saja (fitur, penyedia, status, durasi) — bukan isi prompt/response.
 * Output AI selalu berupa draf; pemanggil tidak boleh menulis hasilnya ke database tanpa konfirmasi user.
 */
export async function runAi<T>(
  ctx: { organizationId: string; userId?: string },
  feature: string,
  fn: (ai: ResolvedAi) => Promise<T>,
): Promise<T> {
  const ai = await getAiModel(ctx.organizationId);
  const started = Date.now();
  const db = forTenant(prisma, ctx.organizationId);
  const log = (status: "ok" | "error") =>
    db.aiCallLog
      .create({
        data: {
          userId: ctx.userId ?? null,
          feature,
          provider: ai.provider,
          model: ai.modelId,
          status,
          durationMs: Date.now() - started,
        } as never,
      })
      .catch(() => undefined);
  try {
    const out = await fn(ai);
    await log("ok");
    return out;
  } catch (error) {
    await log("error");
    throw new AppError(describeAiError(error, ""), 502, "ai_failed");
  }
}

/** Pesan error ramah tanpa membocorkan kunci. */
export function describeAiError(error: unknown, secret: string): string {
  const e = error as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = e?.statusCode ?? e?.status;
  if (status === 401 || status === 403)
    return "API key ditolak oleh penyedia. Periksa kembali key Anda.";
  if (status === 404) return "Model tidak ditemukan. Periksa nama model.";
  if (status === 429) return "Kuota atau batas permintaan penyedia terlampaui.";
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return "Penyedia tidak merespons tepat waktu.";
  if (status && status >= 500) return "Penyedia AI sedang bermasalah. Coba lagi nanti.";
  let msg = e?.message ?? "Gagal menghubungi penyedia AI.";
  if (secret) msg = msg.split(secret).join("[REDACTED]");
  return msg.slice(0, 200);
}
