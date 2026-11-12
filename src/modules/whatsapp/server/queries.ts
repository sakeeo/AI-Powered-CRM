import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";

type Where = Prisma.ConversationWhereInput;

export type InboxFilter = "all" | "mine" | "unassigned";

export async function listConversations(
  ctx: TenantContext,
  opts: { filter?: InboxFilter; status?: "open" | "closed"; q?: string; take?: number } = {},
) {
  const where: Where = {
    AND: [
      scopeWhere(ctx, "view", "Conversation") as Where,
      { status: opts.status ?? "open" },
      ...(opts.filter === "mine" ? [{ assigneeId: ctx.userId }] : []),
      ...(opts.filter === "unassigned" ? [{ assigneeId: null }] : []),
      ...(opts.q
        ? [
            {
              OR: [
                { displayName: { contains: opts.q, mode: "insensitive" as const } },
                { phone: { contains: opts.q } },
                { lastMessagePreview: { contains: opts.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };
  return ctx.db.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: Math.min(opts.take ?? 100, 200),
    include: {
      contact: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });
}

export async function getConversation(ctx: TenantContext, id: string) {
  const conv = await ctx.db.conversation.findFirst({
    where: { AND: [{ id }, scopeWhere(ctx, "view", "Conversation") as Where] },
    include: {
      contact: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });
  if (!conv) throw NotFoundError("Percakapan");
  assertCan(ctx, "view", "Conversation", conv);
  const messages = await ctx.db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { conv, messages: messages.reverse() };
}

export async function unreadTotal(ctx: TenantContext) {
  const agg = await ctx.db.conversation.aggregate({
    where: { AND: [scopeWhere(ctx, "view", "Conversation") as Where, { status: "open" }] },
    _sum: { unreadCount: true },
  });
  return agg._sum.unreadCount ?? 0;
}
