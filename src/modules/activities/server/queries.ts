import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import type { ActivityBucket, ActivityLink } from "@/modules/activities/constants";

type Where = Prisma.ActivityWhereInput;

const include = {
  lead: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
} as const;

/** Timeline satu record: terbaru di atas, hanya aktivitas yang boleh dilihat pengguna. */
export async function listTimeline(ctx: TenantContext, link: ActivityLink) {
  assertCan(ctx, "view", "Activity");
  const key = (Object.keys(link) as (keyof ActivityLink)[]).find((k) => link[k]);
  if (!key) return [];
  return ctx.db.activity.findMany({
    where: { AND: [{ [key]: link[key] }, scopeWhere(ctx, "view", "Activity") as Where] },
    orderBy: { createdAt: "desc" },
    take: 100,
    include,
  });
}
export type TimelineItem = Awaited<ReturnType<typeof listTimeline>>[number];

/**
 * Halaman Activities & Tasks. Terlambat = terbuka dengan tenggat sebelum sekarang (instan UTC,
 * sehingga tenggat tanggal-saja = akhir hari di zona organisasi). Mendatang = terbuka, tenggat ≥ sekarang atau tanpa tenggat.
 */
export async function listActivities(
  ctx: TenantContext,
  opts: { bucket: ActivityBucket; mine?: boolean; now?: Date },
) {
  assertCan(ctx, "view", "Activity");
  const now = opts.now ?? new Date();
  const bucketWhere: Where =
    opts.bucket === "overdue"
      ? { status: "open", dueAt: { lt: now } }
      : opts.bucket === "upcoming"
        ? { status: "open", OR: [{ dueAt: { gte: now } }, { dueAt: null }] }
        : { status: { in: ["done", "cancelled"] } };
  return ctx.db.activity.findMany({
    where: {
      AND: [
        bucketWhere,
        scopeWhere(ctx, "view", "Activity") as Where,
        ...(opts.mine ? [{ ownerId: ctx.userId }] : []),
      ],
    },
    orderBy:
      opts.bucket === "done"
        ? { completedAt: { sort: "desc", nulls: "last" } }
        : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    include,
  });
}

export async function countOverdue(ctx: TenantContext, now = new Date()) {
  return ctx.db.activity.count({
    where: {
      AND: [{ status: "open", dueAt: { lt: now } }, scopeWhere(ctx, "view", "Activity") as Where],
    },
  });
}

/** Untuk papan Kanban: deal mana yang punya aktivitas terbuka & kapan interaksi terakhir. */
export async function dealActivityInfo(ctx: TenantContext, dealIds: string[]) {
  if (!dealIds.length) return new Map<string, { hasOpen: boolean; lastAt: Date | null }>();
  const rows = await ctx.db.activity.groupBy({
    by: ["dealId", "status"],
    where: { dealId: { in: dealIds } },
    _max: { updatedAt: true },
  });
  const out = new Map<string, { hasOpen: boolean; lastAt: Date | null }>();
  for (const r of rows) {
    if (!r.dealId) continue;
    const cur = out.get(r.dealId) ?? { hasOpen: false, lastAt: null };
    if (r.status === "open") cur.hasOpen = true;
    const t = r._max.updatedAt;
    if (t && (!cur.lastAt || t > cur.lastAt)) cur.lastAt = t;
    out.set(r.dealId, cur);
  }
  return out;
}
