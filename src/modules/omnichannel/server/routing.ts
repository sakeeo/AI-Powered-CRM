import type { TenantContext } from "@/lib/context";
import {
  ASSIGNABLE_ROLES,
  type ChannelKind,
  type RoutingStrategy,
} from "@/modules/omnichannel/constants";
import { chooseAssignee } from "@/modules/omnichannel/routing";

type Db = TenantContext["db"];

export async function eligibleAssignees(db: Db): Promise<string[]> {
  const members = await db.member.findMany({
    where: { active: true, role: { in: [...ASSIGNABLE_ROLES] } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * Terapkan routing kanal pada percakapan BARU: menugaskan sesuai aturan organisasi (default: tanpa routing).
 * Giliran round robin diklaim lewat compare-and-swap pada kursor sehingga dua pesan bersamaan tidak
 * mendapat penerima yang sama secara tidak sengaja. Mengembalikan assigneeId (atau null).
 */
export async function routeNewConversation(
  db: Db,
  input: { conversationId: string; kind: ChannelKind; stickyOwnerId: string | null },
): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const rule = await db.channelRouting.findFirst({ where: { kind: input.kind } });
    if (!rule || rule.strategy === "none") return null;
    const decision = chooseAssignee({
      strategy: rule.strategy as RoutingStrategy,
      stickyOwnerId: input.stickyOwnerId,
      pool: Array.isArray(rule.pool) ? (rule.pool as string[]) : [],
      cursor: rule.cursor,
      eligible: await eligibleAssignees(db),
    });
    if (!decision.assigneeId) return null;
    if (decision.usedCursor) {
      const claimed = await db.channelRouting.updateMany({
        where: { id: rule.id, cursor: rule.cursor },
        data: { cursor: rule.cursor + 1 },
      });
      if (claimed.count === 0) continue; // kalah balapan: baca kursor terbaru lalu coba lagi
    }
    await db.conversation.update({
      where: { id: input.conversationId },
      data: { assigneeId: decision.assigneeId },
    });
    await db.notification.createMany({
      data: [
        {
          userId: decision.assigneeId,
          type: "conversation_assigned",
          title: "Percakapan baru ditugaskan ke Anda",
          body: null,
          link: `/inbox?c=${input.conversationId}`,
          dedupeKey: `conv-assign:${input.conversationId}:${decision.assigneeId}`,
        },
      ] as never,
      skipDuplicates: true,
    });
    return decision.assigneeId;
  }
  return null;
}
