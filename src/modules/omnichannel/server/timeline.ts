import type { Prisma } from "@/generated/prisma/client";
import { scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { resolveSubject } from "@/modules/intelligence/server/followup";
import type { FollowUpSubject } from "@/modules/intelligence/schemas";
import {
  isAutoLoggedMessageActivity,
  mergeTimeline,
  stripHtml,
  type TimelineItem,
} from "@/modules/omnichannel/timeline";

/**
 * Timeline terpadu satu lead/contact/company: pesan percakapan (WhatsApp, email, kanal lain) + aktivitas
 * (call, meeting, catatan, task, email tercatat) dalam satu urutan waktu. Menghormati izin: pesan hanya
 * bila pengguna boleh melihat percakapannya; aktivitas sesuai scope Activity.
 */
export async function getUnifiedTimeline(
  ctx: TenantContext,
  s: FollowUpSubject,
  limit = 100,
): Promise<TimelineItem[]> {
  await resolveSubject(ctx, s); // izin & keberadaan subjek
  const link =
    s.type === "lead"
      ? { leadId: s.id }
      : s.type === "company"
        ? { companyId: s.id }
        : { contactId: s.id };

  // Company: percakapan para contact-nya ikut dihitung.
  let convWhere: Prisma.ConversationWhereInput;
  if (s.type === "company") {
    const members = await ctx.db.contactCompany.findMany({
      where: { companyId: s.id },
      select: { contactId: true },
    });
    convWhere = { contactId: { in: members.map((m) => m.contactId) } };
  } else convWhere = s.type === "lead" ? { leadId: s.id } : { contactId: s.id };

  const canConv = ctx.ability.can("view", "Conversation");
  const canAct = ctx.ability.can("view", "Activity");
  const [messages, acts, syncLogs] = await Promise.all([
    canConv
      ? ctx.db.message.findMany({
          where: {
            conversation: {
              AND: [
                convWhere,
                scopeWhere(ctx, "view", "Conversation") as Prisma.ConversationWhereInput,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { conversation: { select: { id: true, kind: true, channelLabel: true } } },
        })
      : [],
    canAct
      ? ctx.db.activity.findMany({
          where: { AND: [link, scopeWhere(ctx, "view", "Activity") as Prisma.ActivityWhereInput] },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    // Email tercatat Gmail sudah muncul sebagai pesan percakapan: jangan tampil ganda.
    ctx.db.emailSyncLog.findMany({
      where: {
        activityId: { not: null },
        createdAt: { gte: new Date(Date.now() - 365 * 86_400_000) },
      },
      select: { activityId: true, messageId: true },
      take: 5000,
    }),
  ]);
  const msgIds = new Set(messages.map((m) => m.externalId).filter(Boolean));
  const dupEmailActs = new Set(
    syncLogs.filter((l) => msgIds.has(`gmail:${l.messageId}`)).map((l) => l.activityId!),
  );

  const items: TimelineItem[] = [
    ...messages.map((m): TimelineItem => ({
      id: `m:${m.id}`,
      at: m.createdAt,
      source: "message",
      channel: m.conversation.kind === "other" ? "other" : m.conversation.kind,
      direction: m.direction === "out" ? "out" : "in",
      title:
        m.conversation.kind === "other" && m.conversation.channelLabel
          ? m.conversation.channelLabel
          : "",
      text: m.body,
      href: `/inbox?c=${m.conversation.id}`,
    })),
    ...acts
      .filter((a) => !isAutoLoggedMessageActivity(a) && !dupEmailActs.has(a.id))
      .map((a): TimelineItem => ({
        id: `a:${a.id}`,
        at: a.completedAt ?? a.createdAt,
        source: "activity",
        channel: a.type,
        direction: null,
        title: a.subject,
        text: stripHtml(a.body),
        href: null,
      })),
  ];
  return mergeTimeline(items, limit);
}
