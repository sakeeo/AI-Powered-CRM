import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import {
  acceptanceRate,
  recommendFollowUp,
  type FollowUpChannel,
  type FollowUpRecommendation,
  type Interaction,
} from "@/modules/intelligence/followup";
import type { FollowUpSubject } from "@/modules/intelligence/schemas";
import { getOrganization } from "@/modules/organizations/server/queries";

const CHANNEL_TYPES = new Set<string>(["call", "email", "meeting", "whatsapp"]);
const HORIZON_DAYS = 180;

/** Pastikan subjek ada & boleh dilihat pengguna; kembalikan nama. */
export async function resolveSubject(ctx: TenantContext, s: FollowUpSubject) {
  if (s.type === "lead") {
    assertCan(ctx, "view", "Lead");
    const r = await ctx.db.lead.findFirst({
      where: { AND: [{ id: s.id }, scopeWhere(ctx, "view", "Lead") as Prisma.LeadWhereInput] },
      select: { id: true, name: true, ownerId: true },
    });
    if (!r) throw NotFoundError("Lead");
    return r;
  }
  const subj = s.type === "company" ? "Company" : "Contact";
  assertCan(ctx, "view", subj);
  const r =
    s.type === "company"
      ? await ctx.db.company.findFirst({
          where: { id: s.id, deletedAt: null },
          select: { id: true, name: true, ownerId: true },
        })
      : await ctx.db.contact.findFirst({
          where: { id: s.id, deletedAt: null },
          select: { id: true, name: true, ownerId: true },
        });
  if (!r) throw NotFoundError(subj);
  return r;
}

const linkWhere = (s: FollowUpSubject) =>
  s.type === "lead"
    ? { leadId: s.id }
    : s.type === "company"
      ? { companyId: s.id }
      : { contactId: s.id };

const toInteraction = (channel: string, at: Date, inbound = false): Interaction | null =>
  CHANNEL_TYPES.has(channel) ? { channel: channel as FollowUpChannel, at, inbound } : null;

/** Rekomendasi follow-up untuk satu lead/contact/company. Membaca saja. */
export async function getFollowUpRecommendation(
  ctx: TenantContext,
  s: FollowUpSubject,
  now = new Date(),
): Promise<FollowUpRecommendation & { name: string }> {
  const subject = await resolveSubject(ctx, s);
  const since = new Date(now.getTime() - HORIZON_DAYS * 86_400_000);
  const link = linkWhere(s);
  const convoLink =
    s.type === "lead" ? { leadId: s.id } : s.type === "contact" ? { contactId: s.id } : null;
  const [{ timezone }, acts, msgs, orgActs] = await Promise.all([
    getOrganization(ctx),
    ctx.db.activity.findMany({
      where: { ...link, status: "done", type: { in: [...CHANNEL_TYPES] } },
      select: { type: true, completedAt: true, createdAt: true },
      take: 500,
    }),
    convoLink
      ? ctx.db.message.findMany({
          where: { conversation: convoLink },
          select: { direction: true, createdAt: true },
          take: 500,
        })
      : Promise.resolve([]),
    // Pola organisasi: agregat saja (tipe + waktu), tanpa isi/relasi record.
    ctx.db.activity.findMany({
      where: {
        status: "done",
        type: { in: [...CHANNEL_TYPES] },
        OR: [{ completedAt: { gte: since } }, { completedAt: null, createdAt: { gte: since } }],
      },
      select: { type: true, completedAt: true, createdAt: true },
      take: 5000,
    }),
  ]);
  const party = [
    ...acts.map((a) => toInteraction(a.type, a.completedAt ?? a.createdAt)),
    ...msgs.map((m) => toInteraction("whatsapp", m.createdAt, m.direction === "in")),
  ].filter((x): x is Interaction => !!x);
  const org = orActs(orgActs);
  return {
    ...recommendFollowUp({ name: subject.name, party, org, now, timezone }),
    name: subject.name,
  };
}

function orActs(rows: { type: string; completedAt: Date | null; createdAt: Date }[]) {
  return rows
    .map((a) => toInteraction(a.type, a.completedAt ?? a.createdAt))
    .filter((x): x is Interaction => !!x);
}

/** Metrik AI Draft Acceptance Rate (org-wide, agregat). */
export async function getAcceptanceMetrics(ctx: TenantContext, days = 90, now = new Date()) {
  assertCan(ctx, "view", "Report");
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await ctx.db.recommendationFeedback.groupBy({
    by: ["decision"],
    where: { kind: "followup", createdAt: { gte: since } },
    _count: { _all: true },
  });
  const count = (d: string) => rows.find((r) => r.decision === d)?._count._all ?? 0;
  const accepted = count("accepted");
  const rejected = count("rejected");
  return { accepted, rejected, rate: acceptanceRate(accepted, rejected), days };
}
