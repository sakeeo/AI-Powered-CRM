"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { resolveSubject } from "@/modules/intelligence/server/followup";
import { logChannelMessageSchema, saveRoutingSchema } from "@/modules/omnichannel/schemas";
import { ingestChannelMessage } from "@/modules/omnichannel/server/channel";
import { eligibleAssignees } from "@/modules/omnichannel/server/routing";

/** Simpan aturan routing per kanal. Hanya Owner/Admin. Pool harus berisi anggota aktif yang dapat menangani inbox. */
export const saveChannelRouting = tenantAction(saveRoutingSchema, async (ctx, input) => {
  assertCan(ctx, "manage", "Automation");
  const eligible = new Set(await eligibleAssignees(ctx.db));
  const pool = [...new Set(input.pool)];
  if (pool.some((id) => !eligible.has(id)))
    throw new AppError("Pool hanya boleh berisi anggota aktif yang dapat menangani inbox");
  const before = await ctx.db.channelRouting.findFirst({ where: { kind: input.kind } });
  if (before) {
    await ctx.db.channelRouting.update({
      where: { id: before.id },
      data: { strategy: input.strategy, pool, updatedBy: ctx.userId },
    });
  } else {
    await ctx.db.channelRouting.create({
      data: { kind: input.kind, strategy: input.strategy, pool, updatedBy: ctx.userId } as never,
    });
  }
  await writeAudit(ctx, {
    action: "channel_routing.updated",
    entityType: "ChannelRouting",
    entityId: before?.id,
    before: before ? { strategy: before.strategy, pool: before.pool } : undefined,
    after: { kind: input.kind, strategy: input.strategy, pool },
  });
  revalidatePath("/settings/routing");
  return {};
});

/**
 * Catat pesan di kanal lain secara manual (kanal tanpa integrasi). Hanya mencatat — tidak mengirim apa pun.
 * Percakapan dikelompokkan per (kanal, contact/lead) dan muncul di Inbox serta timeline terpadu.
 */
export const logChannelMessage = tenantAction(logChannelMessageSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Activity");
  const subject = input.contactId
    ? await resolveSubject(ctx, { type: "contact", id: input.contactId })
    : await resolveSubject(ctx, { type: "lead", id: input.leadId! });
  const entityId = (input.contactId ?? input.leadId)!;
  const label = input.channelLabel.trim();
  const r = await ingestChannelMessage(ctx.db, {
    kind: "other",
    handle: `manual:${label.toLowerCase()}:${entityId}`,
    direction: input.direction,
    body: input.body,
    name: subject.name,
    channelType: "manual",
    channelLabel: label,
    contactId: input.contactId ?? null,
    leadId: input.contactId ? null : (input.leadId ?? null),
    sentBy: ctx.userId,
  });
  await writeAudit(ctx, {
    action: "conversation.manual_logged",
    entityType: "Conversation",
    entityId: r.conversationId,
    after: { channel: label, direction: input.direction, length: input.body.length },
  });
  revalidatePath("/inbox");
  return { conversationId: r.conversationId };
});
