"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { emitAutomationEvent } from "@/lib/automation";
import { assertCan } from "@/lib/authz";
import { decryptSecret } from "@/lib/crypto";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { idInput } from "@/lib/schema-helpers";
import { ensureLeadSources } from "@/modules/leads/server/queries";
import { assertActiveMember } from "@/modules/organizations/server/queries";
import { sendViaGateway, type WaConfig } from "@/modules/whatsapp/gateway";
import { waProviderFromType } from "@/modules/whatsapp/constants";
import {
  assignConversationSchema,
  conversationStatusSchema,
  sendMessageSchema,
} from "@/modules/whatsapp/schemas";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

async function loadConversation(ctx: ActionContext, id: string) {
  const conv = await ctx.db.conversation.findFirst({ where: { id } });
  if (!conv) throw NotFoundError("Percakapan");
  return conv;
}

async function defaultGateway(ctx: ActionContext): Promise<WaConfig> {
  const row =
    (await ctx.db.tenantConnector.findFirst({
      where: { type: { startsWith: "whatsapp_" }, isDefault: true, status: { not: "disabled" } },
    })) ??
    (await ctx.db.tenantConnector.findFirst({ where: { type: { startsWith: "whatsapp_" } } }));
  const provider = row && waProviderFromType(row.type);
  if (!row || !provider)
    throw new AppError("Hubungkan connector WhatsApp di Settings → Connectors");
  const cfg = JSON.parse(
    decryptSecret(row.configEncrypted, `${ctx.organizationId}:${row.type}`),
  ) as { token: string; apiUrl?: string };
  return { provider, token: cfg.token, apiUrl: cfg.apiUrl };
}

/**
 * Kirim pesan keluar. SELALU aksi eksplisit pengguna (tombol Kirim) — tidak ada pengiriman otomatis,
 * termasuk dari AI. Perlu izin mengubah percakapan; dibatasi laju per pengguna.
 */
export const sendWhatsappMessage = tenantAction(sendMessageSchema, async (ctx, input) => {
  const conv = await loadConversation(ctx, input.conversationId);
  assertCan(ctx, "update", "Conversation", conv);
  const rl = await rateLimit(`wa-send:${ctx.organizationId}:${ctx.userId}`, 30, 60);
  if (!rl.allowed)
    throw new AppError("Terlalu banyak pesan. Coba lagi sebentar.", 429, "rate_limited");
  const gateway = await defaultGateway(ctx);

  const msg = await ctx.db.message.create({
    data: {
      conversationId: conv.id,
      direction: "out",
      body: input.body,
      status: "sending",
      sentBy: ctx.userId,
    } as never,
  });
  const res = await sendViaGateway(gateway, conv.phoneNormalized, input.body);
  const now = new Date();
  await ctx.db.message.update({
    where: { id: msg.id },
    data: res.ok
      ? { status: "sent", externalId: res.externalId ? `out:${res.externalId}` : null }
      : { status: "failed", error: res.error },
  });
  await ctx.db.conversation.update({
    where: { id: conv.id },
    data: {
      ...(res.ok
        ? { lastMessageAt: now, lastMessagePreview: `Anda: ${input.body.slice(0, 110)}` }
        : {}),
      unreadCount: 0,
      status: "open",
      // Membalas = mengambil percakapan yang belum ditugaskan.
      ...(conv.assigneeId ? {} : { assigneeId: ctx.userId }),
      updatedBy: ctx.userId,
    },
  });
  if (res.ok && (conv.contactId || conv.leadId)) {
    await ctx.db.activity.create({
      data: {
        type: "whatsapp",
        subject: `WhatsApp keluar: ${input.body.slice(0, 80)}`,
        body: `<p>${esc(input.body)}</p>`,
        status: "done",
        completedAt: now,
        ownerId: ctx.userId,
        createdBy: ctx.userId,
        contactId: conv.contactId,
        leadId: conv.contactId ? null : conv.leadId,
      } as never,
    });
  }
  await writeAudit(ctx, {
    action: res.ok ? "whatsapp.message_sent" : "whatsapp.message_failed",
    entityType: "Conversation",
    entityId: conv.id,
    after: { length: input.body.length, error: res.ok ? undefined : res.error },
  });
  revalidatePath("/inbox");
  if (!res.ok) throw new AppError(`Pesan gagal terkirim: ${res.error}`);
  return { id: msg.id };
});

/** Ambil/tugaskan percakapan. Sales Rep hanya boleh mengambil yang belum ditugaskan atau melepas miliknya. */
export const assignConversation = tenantAction(
  assignConversationSchema,
  async (ctx, { id, assigneeId }) => {
    const conv = await loadConversation(ctx, id);
    assertCan(ctx, "update", "Conversation", conv);
    if (ctx.role === "sales_rep") {
      const claiming = assigneeId === ctx.userId && !conv.assigneeId;
      const releasing = assigneeId === null && conv.assigneeId === ctx.userId;
      if (!claiming && !releasing) throw ForbiddenError();
    }
    if (assigneeId) await assertActiveMember(ctx, assigneeId);
    await ctx.db.conversation.update({
      where: { id },
      data: { assigneeId, updatedBy: ctx.userId },
    });
    await writeAudit(ctx, {
      action: "whatsapp.conversation_assigned",
      entityType: "Conversation",
      entityId: id,
      before: { assigneeId: conv.assigneeId },
      after: { assigneeId },
    });
    revalidatePath("/inbox");
  },
);

export const setConversationStatus = tenantAction(
  conversationStatusSchema,
  async (ctx, { id, status }) => {
    const conv = await loadConversation(ctx, id);
    assertCan(ctx, "update", "Conversation", conv);
    await ctx.db.conversation.update({ where: { id }, data: { status, updatedBy: ctx.userId } });
    revalidatePath("/inbox");
  },
);

export const markConversationRead = tenantAction(idInput, async (ctx, { id }) => {
  const conv = await loadConversation(ctx, id);
  assertCan(ctx, "view", "Conversation", conv);
  if (conv.unreadCount)
    await ctx.db.conversation.update({ where: { id }, data: { unreadCount: 0 } });
  revalidatePath("/inbox");
});

/** Buat lead dari percakapan yang belum tertaut (nama/nomor dari chat). */
export const createLeadFromConversation = tenantAction(idInput, async (ctx, { id }) => {
  const conv = await loadConversation(ctx, id);
  assertCan(ctx, "update", "Conversation", conv);
  assertCan(ctx, "create", "Lead");
  if (conv.contactId || conv.leadId) throw new AppError("Percakapan sudah tertaut ke data CRM");
  await ensureLeadSources(ctx.db);
  const source = await ctx.db.leadSource.findFirst({ where: { name: "WhatsApp" } });
  const lead = await ctx.db.lead.create({
    data: {
      name: conv.displayName ?? `+${conv.phoneNormalized}`,
      phone: `+${conv.phoneNormalized}`,
      phoneNormalized: conv.phoneNormalized,
      sourceId: source?.id ?? null,
      ownerId: conv.assigneeId ?? ctx.userId,
      createdBy: ctx.userId,
    } as never,
  });
  await ctx.db.conversation.update({
    where: { id },
    data: { leadId: lead.id, updatedBy: ctx.userId },
  });
  await emitAutomationEvent(ctx.db, {
    organizationId: ctx.organizationId,
    trigger: "lead_created",
    entityId: lead.id,
    eventKey: `lead_created:${lead.id}`,
  });
  await writeAudit(ctx, {
    action: "lead.created_from_whatsapp",
    entityType: "Lead",
    entityId: lead.id,
    after: { conversationId: id },
  });
  revalidatePath("/inbox");
  return { id: lead.id };
});
