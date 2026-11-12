/* eslint-disable @typescript-eslint/no-explicit-any -- model Prisma dipilih dinamis per entitas */
import { scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { AppError, ForbiddenError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { dateInTz, zonedToUtc } from "@/lib/timezone";
import {
  ENTITY_LABEL,
  ACTIVITY_TYPE_VALUES,
  PERIOD_LABEL,
  STATUS_VALUES,
  SUM_FIELDS,
  type InsightEntity,
  type InsightPlan,
} from "@/modules/insights/plan";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/modules/leads/constants";

/**
 * Eksekutor rencana Insights — HANYA MEMBACA (count / groupBy / aggregate / findMany). Selalu lewat
 * `ctx.db` (scope tenant) dan `scopeWhere` (izin & kepemilikan pengguna), sehingga hasil tidak pernah
 * melampaui data yang boleh dilihat pengguna itu. Angka berasal dari database, bukan dari LLM.
 */
type Where = Record<string, unknown>;

const SUBJECT = {
  lead: "Lead",
  deal: "Deal",
  contact: "Contact",
  company: "Company",
  activity: "Activity",
  quotation: "Quotation",
} as const;

const BASE_WHERE: Record<InsightEntity, Where> = {
  lead: { archivedAt: null },
  deal: { deletedAt: null },
  contact: { deletedAt: null },
  company: { deletedAt: null },
  activity: {},
  quotation: { deletedAt: null },
};

const DB_FIELD: Record<string, string> = {
  status: "status",
  type: "type",
  owner: "ownerId",
  source: "sourceId",
  stage: "stageId",
};

const ACTIVITY_TYPES: readonly string[] = ACTIVITY_TYPE_VALUES;

const norm = (s: string) => s.trim().toLowerCase();

async function resolveFilter(
  ctx: TenantContext,
  entity: InsightEntity,
  field: string,
  value: string,
): Promise<Where> {
  const v = norm(value);
  if (field === "owner") {
    if (["me", "saya", "aku"].includes(v)) return { ownerId: ctx.userId };
    const members = await ctx.db.member.findMany({
      where: { active: true },
      include: { user: { select: { name: true } } },
    });
    const hit = members.filter((m) => norm(m.user.name) === v || norm(m.user.name).includes(v));
    if (hit.length === 0)
      throw new AppError(`Pengguna "${value}" tidak ditemukan di organisasi ini`);
    return { ownerId: { in: hit.map((m) => m.userId) } };
  }
  if (field === "status") {
    const match = STATUS_VALUES[entity].find((s) => s === v);
    if (!match) throw new AppError(`Status "${value}" tidak dikenal untuk ${ENTITY_LABEL[entity]}`);
    return { status: match };
  }
  if (field === "type") {
    if (!ACTIVITY_TYPES.includes(v)) throw new AppError(`Tipe aktivitas "${value}" tidak dikenal`);
    return { type: v };
  }
  if (field === "stage") {
    const stage = await ctx.db.pipelineStage.findFirst({
      where: { name: { equals: value, mode: "insensitive" } },
    });
    if (!stage) throw new AppError(`Stage "${value}" tidak ditemukan`);
    return { stageId: stage.id };
  }
  if (field === "source") {
    const src = await ctx.db.leadSource.findFirst({
      where: { name: { equals: value, mode: "insensitive" } },
    });
    if (!src) throw new AppError(`Sumber "${value}" tidak ditemukan`);
    return { sourceId: src.id };
  }
  throw new AppError("Filter tidak didukung");
}

/** Rentang waktu [from, to) menurut zona waktu organisasi. */
export function periodRange(preset: InsightPlan["period"]["preset"], now: Date, tz: string) {
  if (preset === "all") return null;
  const today = dateInTz(now, tz); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map(Number);
  const iso = (yy: number, mm: number, dd: number) =>
    zonedToUtc(`${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00`, tz);
  const day = (offset: number) => {
    const t = new Date(Date.UTC(y, m - 1, d + offset));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  };
  switch (preset) {
    case "today":
      return { from: day(0), to: day(1) };
    case "this_week": {
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Senin = 0
      return { from: day(-dow), to: day(7 - dow) };
    }
    case "last_30_days":
      return { from: day(-29), to: day(1) };
    case "this_month":
      return { from: iso(y, m, 1), to: m === 12 ? iso(y + 1, 1, 1) : iso(y, m + 1, 1) };
    case "last_month":
      return { from: m === 1 ? iso(y - 1, 12, 1) : iso(y, m - 1, 1), to: iso(y, m, 1) };
    case "this_year":
      return { from: iso(y, 1, 1), to: iso(y + 1, 1, 1) };
    case "last_year":
      return { from: iso(y - 1, 1, 1), to: iso(y, 1, 1) };
  }
}

export type InsightResult = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  summary: string;
  truncated: boolean;
};

export async function executePlan(
  ctx: TenantContext,
  plan: InsightPlan,
  tz: string,
  now = new Date(),
): Promise<InsightResult> {
  const entity = plan.entity;
  let scope: Where;
  try {
    scope = scopeWhere(ctx, "view", SUBJECT[entity]);
  } catch (e) {
    if (e instanceof ForbiddenError || (e as { status?: number }).status === 403)
      throw new AppError(
        `Anda tidak memiliki akses untuk melihat data ${ENTITY_LABEL[entity]}`,
        403,
        "forbidden",
      );
    throw e;
  }
  const filters: Where[] = [BASE_WHERE[entity], scope];
  for (const f of plan.filters) filters.push(await resolveFilter(ctx, entity, f.field, f.value));
  const range = periodRange(plan.period.preset, now, tz);
  if (range) filters.push({ [plan.period.field]: { gte: range.from, lt: range.to } });
  const where: Where = { AND: filters };

  const model = (ctx.db as unknown as Record<string, any>)[entity] as {
    count: (a: unknown) => Promise<number>;
    groupBy: (a: unknown) => Promise<Record<string, any>[]>;
    findMany: (a: unknown) => Promise<Record<string, any>[]>;
  };
  const label = ENTITY_LABEL[entity];
  const periodText = PERIOD_LABEL[plan.period.preset];
  const sumField = SUM_FIELDS[entity];
  const hasCurrency = entity !== "activity" && entity !== "contact" && entity !== "company";

  const names = await nameLookups(ctx, plan.groupBy);
  const keyLabel = (field: string | null, v: unknown) =>
    field === "owner"
      ? v
        ? (names.owner.get(String(v)) ?? "Pengguna lain")
        : "Belum ditugaskan"
      : field === "stage"
        ? (names.stage.get(String(v)) ?? "—")
        : field === "source"
          ? v
            ? (names.source.get(String(v)) ?? "—")
            : "Tanpa sumber"
          : field === "status" && entity === "lead"
            ? (LEAD_STATUS_LABEL[v as LeadStatus] ?? String(v))
            : String(v ?? "—");

  // ---- list
  if (plan.metric === "list") {
    const total = await model.count({ where });
    const rows = await model.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: plan.limit,
      select: listSelect(entity),
    });
    return {
      title: `Daftar ${label} (${periodText})`,
      columns: listColumns(entity),
      rows: rows.map((r) => listRow(entity, r, names)),
      summary: `Menampilkan ${rows.length} dari ${total} ${label} (${periodText}).`,
      truncated: total > rows.length,
    };
  }

  // ---- count / sum tanpa kelompok
  if (!plan.groupBy) {
    if (plan.metric === "count") {
      const n = await model.count({ where });
      return {
        title: `Jumlah ${label} (${periodText})`,
        columns: ["Jumlah"],
        rows: [[n]],
        summary: `Ada ${n} ${label} (${periodText}).`,
        truncated: false,
      };
    }
    const sums = await model.groupBy({
      by: ["currency"],
      where,
      _sum: { [sumField!]: true },
      _count: { _all: true },
    });
    const rows = sums.map((s) => [
      s.currency as string,
      fmtMoney(s._sum[sumField!], s.currency),
      s._count._all as number,
    ]);
    return {
      title: `Total ${sumField} ${label} (${periodText})`,
      columns: ["Mata uang", "Total", "Jumlah"],
      rows,
      summary: rows.length
        ? `Total ${sumField} ${label} (${periodText}): ${rows.map((r) => r[1]).join(" + ")}.`
        : `Tidak ada ${label} (${periodText}).`,
      truncated: false,
    };
  }

  // ---- dikelompokkan
  if (plan.groupBy === "month") {
    const dateField = plan.period.field;
    const rows = await model.findMany({
      where,
      select: {
        [dateField]: true,
        ...(plan.metric === "sum" ? { [sumField!]: true, currency: true } : {}),
      },
      orderBy: { [dateField]: "asc" },
      take: 5000,
    });
    const buckets = new Map<string, { n: number; sums: Map<string, number> }>();
    for (const r of rows) {
      const at = r[dateField] as Date | null;
      if (!at) continue;
      const key = dateInTz(at, tz).slice(0, 7);
      const b = buckets.get(key) ?? { n: 0, sums: new Map() };
      b.n++;
      if (plan.metric === "sum") {
        const cur = r.currency as string;
        b.sums.set(cur, (b.sums.get(cur) ?? 0) + Number(r[sumField!] ?? 0));
      }
      buckets.set(key, b);
    }
    const out = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, b]) => [
        k,
        plan.metric === "count"
          ? b.n
          : [...b.sums].map(([c, v]) => formatMoney(v.toFixed(2), c)).join(" + "),
      ]);
    return {
      title: `${plan.metric === "count" ? "Jumlah" : "Total"} ${label} per bulan (${periodText})`,
      columns: ["Bulan", plan.metric === "count" ? "Jumlah" : "Total"],
      rows: out,
      summary: `${rows.length} ${label} dikelompokkan per bulan (${periodText}).`,
      truncated: rows.length >= 5000,
    };
  }

  const field = DB_FIELD[plan.groupBy];
  const by = plan.metric === "sum" && hasCurrency ? [field, "currency"] : [field];
  const grouped = await model.groupBy({
    by,
    where,
    _count: { _all: true },
    ...(plan.metric === "sum" ? { _sum: { [sumField!]: true } } : {}),
  });
  const rows = grouped
    .map((g) => {
      const key = keyLabel(plan.groupBy, g[field]);
      return plan.metric === "count"
        ? ([key, g._count._all as number] as (string | number)[])
        : ([key, g.currency as string, fmtMoney(g._sum[sumField!], g.currency)] as (
            string | number
          )[]);
    })
    .sort((a, b) =>
      plan.metric === "count"
        ? (b[1] as number) - (a[1] as number)
        : String(a[0]).localeCompare(String(b[0])),
    );
  return {
    title: `${plan.metric === "count" ? "Jumlah" : "Total"} ${label} per ${plan.groupBy} (${periodText})`,
    columns:
      plan.metric === "count" ? [plan.groupBy, "Jumlah"] : [plan.groupBy, "Mata uang", "Total"],
    rows,
    summary: rows.length
      ? `${rows.length} kelompok ${plan.groupBy} untuk ${label} (${periodText}).`
      : `Tidak ada ${label} (${periodText}).`,
    truncated: false,
  };
}

const fmtMoney = (v: unknown, cur: string) =>
  formatMoney(
    v === null || v === undefined ? "0" : (v as { toFixed: (n: number) => string }).toFixed(2),
    cur,
  );

async function nameLookups(ctx: TenantContext, groupBy: string | null) {
  const out = {
    owner: new Map<string, string>(),
    stage: new Map<string, string>(),
    source: new Map<string, string>(),
  };
  // Nama pemilik juga dibutuhkan untuk kolom Owner pada daftar.
  const members = await ctx.db.member.findMany({ include: { user: { select: { name: true } } } });
  for (const m of members) out.owner.set(m.userId, m.user.name);
  if (groupBy === "stage" || groupBy === null) {
    for (const s of await ctx.db.pipelineStage.findMany({ select: { id: true, name: true } }))
      out.stage.set(s.id, s.name);
  }
  if (groupBy === "source" || groupBy === null) {
    for (const s of await ctx.db.leadSource.findMany({ select: { id: true, name: true } }))
      out.source.set(s.id, s.name);
  }
  return out;
}

function listSelect(entity: InsightEntity) {
  const base = { id: true, createdAt: true, ownerId: true } as const;
  switch (entity) {
    case "lead":
      return { ...base, name: true, status: true, budget: true, currency: true };
    case "deal":
      return { ...base, title: true, status: true, value: true, currency: true, stageId: true };
    case "contact":
    case "company":
      return { ...base, name: true };
    case "activity":
      return { ...base, subject: true, type: true, status: true, dueAt: true };
    case "quotation":
      return { ...base, number: true, title: true, status: true, total: true, currency: true };
  }
}
function listColumns(entity: InsightEntity) {
  switch (entity) {
    case "lead":
      return ["Nama", "Status", "Budget", "Owner", "Dibuat"];
    case "deal":
      return ["Judul", "Status", "Nilai", "Stage", "Owner"];
    case "contact":
    case "company":
      return ["Nama", "Owner", "Dibuat"];
    case "activity":
      return ["Subjek", "Tipe", "Status", "Tenggat", "Owner"];
    case "quotation":
      return ["Nomor", "Judul", "Status", "Total", "Owner"];
  }
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
function listRow(
  entity: InsightEntity,
  r: Record<string, any>,
  names: { owner: Map<string, string>; stage: Map<string, string> },
): (string | number)[] {
  const owner = r.ownerId ? (names.owner.get(r.ownerId) ?? "—") : "Belum ditugaskan";
  switch (entity) {
    case "lead":
      return [
        r.name,
        LEAD_STATUS_LABEL[r.status as LeadStatus] ?? r.status,
        r.budget ? fmtMoney(r.budget, r.currency) : "—",
        owner,
        day(r.createdAt),
      ];
    case "deal":
      return [
        r.title,
        r.status,
        fmtMoney(r.value, r.currency),
        names.stage.get(r.stageId) ?? "—",
        owner,
      ];
    case "contact":
    case "company":
      return [r.name, owner, day(r.createdAt)];
    case "activity":
      return [r.subject, r.type, r.status, day(r.dueAt), owner];
    case "quotation":
      return [r.number, r.title, r.status, fmtMoney(r.total, r.currency), owner];
  }
}
