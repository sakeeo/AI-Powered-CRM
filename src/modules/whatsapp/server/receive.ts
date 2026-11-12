import { createHash, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@/lib/context";
import { decryptSecret } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { signPayload, verifySignature } from "@/modules/webhooks/server/receive";
import { parseInbound } from "@/modules/whatsapp/gateway";

type Db = TenantContext["db"];

export const WA_MAX_BODY_BYTES = 50_000;
export const WA_WEBHOOK_RATE = { limit: 120, windowSeconds: 60 };
export { signPayload };

export type WaConnectorRow = {
  organizationId: string;
  type: string;
  configEncrypted: string;
  status: string;
  settings: unknown;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

const sameSecret = (a: string, b: string) => {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

export type WaWebhookResult = { status: number; body: Record<string, unknown> };

/**
 * Pesan masuk dari gateway WhatsApp. Autentikasi: HMAC `X-Signature` atas body mentah, ATAU `token`
 * (query) yang sama dengan secret webhook — untuk gateway yang tidak bisa menandatangani.
 * Idempoten per `externalId` (gateway sering mengirim ulang). Tidak pernah membalas otomatis.
 */
export async function receiveWhatsappWebhook(
  db: Db,
  connector: WaConnectorRow,
  publicId: string,
  req: { rawBody: string; signature: string | null; token: string | null },
): Promise<WaWebhookResult> {
  const fail = (status: number, error: string): WaWebhookResult => ({ status, body: { error } });

  const rl = await rateLimit(
    `wa:${publicId}`,
    WA_WEBHOOK_RATE.limit,
    WA_WEBHOOK_RATE.windowSeconds,
  );
  if (!rl.allowed) return fail(429, "Terlalu banyak permintaan");
  if (connector.status === "disabled") return fail(403, "Connector dinonaktifkan");
  if (Buffer.byteLength(req.rawBody) > WA_MAX_BODY_BYTES) return fail(413, "Payload terlalu besar");

  const config = JSON.parse(
    decryptSecret(connector.configEncrypted, `${connector.organizationId}:${connector.type}`),
  ) as { webhookSecret?: string };
  const secret = config.webhookSecret;
  const authentic =
    !!secret &&
    (verifySignature(secret, req.rawBody, req.signature) ||
      (!!req.token && sameSecret(req.token, secret)));
  if (!authentic) return fail(401, "Autentikasi webhook gagal");

  let json: unknown;
  try {
    json = JSON.parse(req.rawBody);
  } catch {
    return fail(400, "Body bukan JSON yang valid");
  }
  const msg = parseInbound(json);
  if (!msg) return { status: 200, body: { ok: true, ignored: true } };

  const phoneNormalized = normalizePhone(msg.from);
  if (!phoneNormalized) return { status: 200, body: { ok: true, ignored: true } };

  if (msg.externalId) {
    const dup = await db.message.findFirst({
      where: { externalId: msg.externalId },
      select: { id: true },
    });
    if (dup) return { status: 200, body: { ok: true, duplicate: true } };
  }

  const [contact, lead] = await Promise.all([
    db.contact.findFirst({
      where: { phoneNormalized, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findFirst({
      where: { phoneNormalized, archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const preview = msg.body.slice(0, 120);
  const now = new Date();

  const touch = {
    status: "open",
    lastMessageAt: now,
    lastMessagePreview: preview,
    unreadCount: { increment: 1 },
    ...(msg.name ? { displayName: msg.name } : {}),
  };
  // Cari-lalu-buat (bukan upsert: kunci unik gabungan tidak dapat di-scope tenant); balapan ditangani P2002.
  let conv = await db.conversation.findFirst({ where: { phoneNormalized } });
  if (conv) {
    conv = await db.conversation.update({ where: { id: conv.id }, data: touch });
  } else {
    try {
      conv = await db.conversation.create({
        data: {
          channel: connector.type,
          phone: msg.from,
          phoneNormalized,
          displayName: msg.name ?? null,
          contactId: contact?.id ?? null,
          leadId: lead?.id ?? null,
          lastMessageAt: now,
          lastMessagePreview: preview,
          unreadCount: 1,
        } as never,
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      const existing = await db.conversation.findFirstOrThrow({ where: { phoneNormalized } });
      conv = await db.conversation.update({ where: { id: existing.id }, data: touch });
    }
  }
  // Tautkan ke record bila sebelumnya belum tertaut (mis. contact baru dibuat setelah chat pertama).
  if ((!conv.contactId && contact) || (!conv.leadId && lead)) {
    await db.conversation.update({
      where: { id: conv.id },
      data: {
        ...(!conv.contactId && contact ? { contactId: contact.id } : {}),
        ...(!conv.leadId && lead ? { leadId: lead.id } : {}),
      },
    });
  }
  try {
    await db.message.create({
      data: {
        conversationId: conv.id,
        direction: "in",
        body: msg.body,
        externalId: msg.externalId ?? null,
        status: "received",
      } as never,
    });
  } catch (e) {
    // Dua pengiriman paralel dengan externalId sama → unique violation = duplikat.
    if ((e as { code?: string }).code === "P2002") {
      await db.conversation.update({
        where: { id: conv.id },
        data: { unreadCount: { decrement: 1 } },
      });
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    throw e;
  }

  // Log ke timeline record terkait (aktivitas selesai bertipe WhatsApp).
  const contactId = conv.contactId ?? contact?.id ?? null;
  const leadId = conv.leadId ?? lead?.id ?? null;
  if (contactId || leadId) {
    await db.activity.create({
      data: {
        type: "whatsapp",
        subject: `WhatsApp masuk: ${preview.slice(0, 80)}`,
        body: `<p>${esc(msg.body)}</p>`,
        status: "done",
        completedAt: now,
        ownerId: conv.assigneeId,
        contactId,
        leadId: contactId ? null : leadId,
      } as never,
    });
  }
  if (conv.assigneeId) {
    await db.notification.createMany({
      data: [
        {
          userId: conv.assigneeId,
          type: "whatsapp_message",
          title: `Pesan WhatsApp baru dari ${conv.displayName ?? msg.from}`,
          body: preview,
          link: `/inbox?c=${conv.id}`,
          dedupeKey: `wa:${conv.id}:${msg.externalId ?? now.getTime()}`,
        },
      ] as never,
      skipDuplicates: true,
    });
  }
  return { status: 200, body: { ok: true, conversationId: conv.id } };
}
