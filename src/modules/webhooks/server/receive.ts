import { createHmac, timingSafeEqual } from "node:crypto";
import { writeAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { toDecimal } from "@/lib/money-db";
import type { TenantContext } from "@/lib/context";
import { ensureLeadSources } from "@/modules/leads/server/queries";
import { parseWebhookPayload } from "@/modules/webhooks/schemas";

export const MAX_BODY_BYTES = 100_000;
export const WEBHOOK_RATE = { limit: 60, windowSeconds: 60 };

type Db = TenantContext["db"];

export type InboundWebhookRow = {
  publicId: string;
  organizationId: string;
  secretEncrypted: string;
  isActive: boolean;
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

/** HMAC-SHA256 hex dari body mentah; dipakai pengirim (header `X-Signature: sha256=<hex>`). */
export function signPayload(secret: string, rawBody: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const provided = header.trim().replace(/^sha256=/i, "");
  const expected = signPayload(secret, rawBody);
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Proses satu permintaan webhook untuk tenant yang sudah teridentifikasi dari URL.
 * Urutan: rate limit → aktif? → ukuran → signature → JSON → validasi Zod → buat lead (sumber "Website").
 * Setiap hasil dicatat di WebhookDelivery (tanpa payload mentah).
 */
export async function receiveWebhook(
  db: Db,
  webhook: InboundWebhookRow,
  req: { rawBody: string; signature: string | null; ip: string | null; defaultCurrency?: string },
): Promise<WebhookResult> {
  const log = (status: string, httpStatus: number, error?: string, leadId?: string) =>
    db.webhookDelivery
      .create({
        data: {
          status,
          httpStatus,
          error: error ?? null,
          leadId: leadId ?? null,
          ipAddress: req.ip,
        } as never,
      })
      .catch(() => undefined);

  const fail = async (
    status: string,
    httpStatus: number,
    message: string,
  ): Promise<WebhookResult> => {
    await log(status, httpStatus, message);
    return { status: httpStatus, body: { error: message } };
  };

  const rl = await rateLimit(
    `webhook:${webhook.publicId}`,
    WEBHOOK_RATE.limit,
    WEBHOOK_RATE.windowSeconds,
  );
  if (!rl.allowed) return fail("rate_limited", 429, "Terlalu banyak permintaan");
  if (!webhook.isActive) return fail("inactive", 403, "Webhook dinonaktifkan");
  if (Buffer.byteLength(req.rawBody) > MAX_BODY_BYTES) {
    return fail("invalid_payload", 413, "Payload terlalu besar");
  }

  const secret = decryptSecret(
    webhook.secretEncrypted,
    `${webhook.organizationId}:webhook_inbound`,
  );
  if (!verifySignature(secret, req.rawBody, req.signature)) {
    return fail("invalid_signature", 401, "Signature tidak valid");
  }

  let json: unknown;
  try {
    json = JSON.parse(req.rawBody);
  } catch {
    return fail("invalid_payload", 400, "Body bukan JSON yang valid");
  }
  const parsed = parseWebhookPayload(json);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "payload"}: ${i.message}`)
      .join("; ");
    return fail("invalid_payload", 422, msg.slice(0, 300));
  }

  await ensureLeadSources(db);
  const source = await db.leadSource.findFirst({ where: { name: "Website", isSystem: true } });
  const { budget, ...data } = parsed.data;
  const lead = await db.lead.create({
    data: {
      ...data,
      phoneNormalized: normalizePhone(data.phone),
      budget: toDecimal(budget),
      currency: req.defaultCurrency ?? "IDR",
      sourceId: source?.id ?? null,
      ownerId: null,
    } as never,
  });
  await writeAudit(
    { db, userId: null, ip: req.ip },
    {
      action: "lead.created_by_webhook",
      entityType: "Lead",
      entityId: lead.id,
      after: { name: lead.name },
    },
  );
  await db.inboundWebhook.update({
    where: { organizationId: webhook.organizationId },
    data: { lastReceivedAt: new Date() },
  });
  await log("accepted", 201, undefined, lead.id);
  return { status: 201, body: { ok: true, id: lead.id } };
}
