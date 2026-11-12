import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { NotFoundError } from "@/lib/errors";
import { planSchema, type InsightPlan } from "@/modules/insights/plan";

export type SavedReportDto = {
  id: string;
  name: string;
  definition: InsightPlan;
  visibility: string;
  mine: boolean;
  frequency: string;
  weekday: number | null;
  monthday: number | null;
  hour: number;
  recipientIds: string[];
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
};

/** Laporan milik sendiri + yang dibagikan ke organisasi. */
export async function listSavedReports(ctx: TenantContext): Promise<SavedReportDto[]> {
  assertCan(ctx, "view", "Report");
  const rows = await ctx.db.savedReport.findMany({
    where: { OR: [{ ownerId: ctx.userId }, { visibility: "organization" }] },
    orderBy: { name: "asc" },
  });
  return rows.flatMap((r) => {
    const def = planSchema.safeParse(r.definition);
    if (!def.success) return [];
    return [
      {
        id: r.id,
        name: r.name,
        definition: def.data,
        visibility: r.visibility,
        mine: r.ownerId === ctx.userId,
        frequency: r.frequency,
        weekday: r.weekday,
        monthday: r.monthday,
        hour: r.hour,
        recipientIds: Array.isArray(r.recipientIds) ? (r.recipientIds as string[]) : [],
        nextRunAt: r.nextRunAt,
        lastRunAt: r.lastRunAt,
        lastStatus: r.lastStatus,
      },
    ];
  });
}

export async function getSavedReport(ctx: TenantContext, id: string) {
  assertCan(ctx, "view", "Report");
  const row = await ctx.db.savedReport.findFirst({
    where: { id, OR: [{ ownerId: ctx.userId }, { visibility: "organization" }] },
  });
  if (!row) throw NotFoundError("Laporan");
  const def = planSchema.safeParse(row.definition);
  if (!def.success) throw NotFoundError("Laporan");
  return { id: row.id, name: row.name, definition: def.data };
}

/** Opsi nilai filter untuk form builder (nama, bukan id). */
export async function builderOptions(ctx: TenantContext) {
  const [members, stages, sources] = await Promise.all([
    ctx.db.member.findMany({
      where: { active: true },
      include: { user: { select: { name: true } } },
    }),
    ctx.db.pipelineStage.findMany({
      where: { archivedAt: null },
      orderBy: { position: "asc" },
      select: { name: true },
    }),
    ctx.db.leadSource.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return {
    owners: members.map((m) => ({ userId: m.userId, name: m.user.name })),
    stages: [...new Set(stages.map((s) => s.name))],
    sources: sources.map((s) => s.name),
  };
}
