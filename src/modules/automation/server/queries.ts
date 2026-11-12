import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import type { Trigger } from "@/modules/automation/constants";
import { actionSchema, type AutomationAction } from "@/modules/automation/schemas";

export type RuleDto = {
  id: string;
  name: string;
  trigger: Trigger;
  actions: AutomationAction[];
  isActive: boolean;
  maxPerHour: number;
  runCount: number;
};

export async function listRules(ctx: TenantContext): Promise<RuleDto[]> {
  assertCan(ctx, "view", "Automation");
  const rows = await ctx.db.automationRule.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger as Trigger,
    actions: (r.actions as unknown[]).flatMap((a) => {
      const p = actionSchema.safeParse(a);
      return p.success ? [p.data] : [];
    }),
    isActive: r.isActive,
    maxPerHour: r.maxPerHour,
    runCount: r.runCount,
  }));
}

export type RunDto = {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: string;
  entityType: string;
  entityId: string;
  status: string;
  error: string | null;
  results: { type: string; ok: boolean; message: string }[];
  createdAt: Date;
};

export async function listRuns(
  ctx: TenantContext,
  opts: { ruleId?: string; limit?: number } = {},
): Promise<RunDto[]> {
  assertCan(ctx, "view", "Automation");
  const rows = await ctx.db.automationRun.findMany({
    where: opts.ruleId ? { ruleId: opts.ruleId } : {},
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? 50, 200),
    include: { rule: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    ruleName: r.rule.name,
    trigger: r.trigger,
    entityType: r.entityType,
    entityId: r.entityId,
    status: r.status,
    error: r.error,
    results: Array.isArray(r.results) ? (r.results as RunDto["results"]) : [],
    createdAt: r.createdAt,
  }));
}
