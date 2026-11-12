import type { TenantContext } from "@/lib/context";
import type { ChannelKind } from "@/modules/omnichannel/constants";
import { routeNewConversation } from "@/modules/omnichannel/server/routing";

type Db = TenantContext["db"];

export type ChannelMessageInput = {
  kind: ChannelKind;
  /** Pengenal lawan bicara ternormalisasi: email huruf kecil / `manual:<label>:<id>`. */
  handle: string;
  direction: "in" | "out";
  body: string;
  /** Idempotensi per pesan (mis. `gmail:<id>`). */
  externalId?: string | null;
  at?: Date;
  name?: string | null;
  email?: string | null;
  channelType: string;
  channelLabel?: string | null;
  /** Tautan eksplisit (kanal manual); bila kosong dicari dari email. */
  contactId?: string | null;
  leadId?: string | null;
  sentBy?: string | null;
};

export type IngestResult = { conversationId: string; duplicate: boolean; created: boolean };

/**
 * Masukkan satu pesan ke percakapan kanal-terpadu (email, kanal lain). Idempoten per `externalId`; tautan otomatis
 * ke contact/lead lewat email; percakapan baru dirutekan sesuai aturan organisasi. TIDAK pernah membalas otomatis.
 * (WhatsApp tetap memakai jalur khusus `receiveWhatsappWebhook` yang menerapkan routing yang sama.)
 */
export async function ingestChannelMessage(
  db: Db,
  input: ChannelMessageInput,
): Promise<IngestResult> {
  if (input.externalId) {
    const dup = await db.message.findFirst({
      where: { externalId: input.externalId },
      select: { conversationId: true },
    });
    if (dup) return { conversationId: dup.conversationId, duplicate: true, created: false };
  }
  const email = input.email?.toLowerCase() ?? null;
  const [contact, lead] = await Promise.all([
    input.contactId
      ? db.contact.findFirst({ where: { id: input.contactId, deletedAt: null } })
      : email
        ? db.contact.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
            orderBy: { createdAt: "asc" },
          })
        : null,
    input.leadId
      ? db.lead.findFirst({ where: { id: input.leadId } })
      : email
        ? db.lead.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, archivedAt: null },
            orderBy: { createdAt: "desc" },
          })
        : null,
  ]);
  const at = input.at ?? new Date();
  const preview =
    (input.direction === "out" ? "Anda: " : "") + input.body.replace(/\s+/g, " ").slice(0, 110);
  const inbound = input.direction === "in";
  const touchFor = (lastAt: Date | null) => ({
    // Pesan lama (mis. sinkron Gmail mundur) tidak boleh memundurkan "pesan terakhir".
    ...(!lastAt || at >= lastAt ? { lastMessageAt: at, lastMessagePreview: preview } : {}),
    ...(inbound ? { status: "open", unreadCount: { increment: 1 } } : {}),
    ...(input.name && inbound ? { displayName: input.name } : {}),
  });
  const find = () =>
    db.conversation.findFirst({ where: { kind: input.kind, handle: input.handle } });
  let conv = await find();
  let created = false;
  if (conv) {
    conv = await db.conversation.update({
      where: { id: conv.id },
      data: touchFor(conv.lastMessageAt),
    });
  } else {
    try {
      conv = await db.conversation.create({
        data: {
          channel: input.channelType,
          kind: input.kind,
          handle: input.handle,
          email,
          channelLabel: input.channelLabel ?? null,
          displayName: input.name ?? null,
          contactId: contact?.id ?? null,
          leadId: lead?.id ?? null,
          lastMessageAt: at,
          lastMessagePreview: preview,
          unreadCount: inbound ? 1 : 0,
          ...(input.sentBy ? { assigneeId: input.sentBy } : {}),
        } as never,
      });
      created = true;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      const existing = await find();
      if (!existing) throw e;
      conv = await db.conversation.update({
        where: { id: existing.id },
        data: touchFor(existing.lastMessageAt),
      });
    }
  }
  if ((!conv.contactId && contact) || (!conv.leadId && lead)) {
    conv = await db.conversation.update({
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
        direction: input.direction,
        body: input.body,
        externalId: input.externalId ?? null,
        status: inbound ? "received" : "sent",
        sentBy: input.sentBy ?? null,
        createdAt: at,
      } as never,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      if (inbound)
        await db.conversation.update({
          where: { id: conv.id },
          data: { unreadCount: { decrement: 1 } },
        });
      return { conversationId: conv.id, duplicate: true, created: false };
    }
    throw e;
  }
  if (created && !conv.assigneeId) {
    await routeNewConversation(db, {
      conversationId: conv.id,
      kind: input.kind,
      stickyOwnerId: contact?.ownerId ?? lead?.ownerId ?? null,
    });
  }
  return { conversationId: conv.id, duplicate: false, created };
}
