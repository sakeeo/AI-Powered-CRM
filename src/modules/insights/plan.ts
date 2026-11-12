import { z } from "zod";

/**
 * Rencana kueri CRM Insights. LLM HANYA menghasilkan rencana ini (JSON terbatas, tervalidasi Zod);
 * eksekusi dilakukan kode deterministik read-only dengan scope tenant + izin pengguna. LLM tidak
 * menulis SQL, tidak melihat hasil data, dan tidak dapat mengekspresikan organizationId/izin.
 */
export const INSIGHT_ENTITIES = [
  "lead",
  "deal",
  "contact",
  "company",
  "activity",
  "quotation",
] as const;
export type InsightEntity = (typeof INSIGHT_ENTITIES)[number];

export const ENTITY_LABEL: Record<InsightEntity, string> = {
  lead: "lead",
  deal: "deal",
  contact: "contact",
  company: "company",
  activity: "aktivitas",
  quotation: "quotation",
};

/** Dimensi filter/kelompok per entitas (nama logis, bukan kolom DB). */
export const FILTER_FIELDS: Record<InsightEntity, readonly string[]> = {
  lead: ["status", "source", "owner"],
  deal: ["status", "stage", "owner"],
  contact: ["owner"],
  company: ["owner"],
  activity: ["type", "status", "owner"],
  quotation: ["status", "owner"],
};
export const GROUP_FIELDS: Record<InsightEntity, readonly string[]> = {
  lead: ["status", "source", "owner", "month"],
  deal: ["status", "stage", "owner", "month"],
  contact: ["owner", "month"],
  company: ["owner", "month"],
  activity: ["type", "status", "owner"],
  quotation: ["status", "owner", "month"],
};
export const PERIOD_FIELDS: Record<InsightEntity, readonly string[]> = {
  lead: ["createdAt"],
  deal: ["createdAt", "closedAt", "expectedCloseDate"],
  contact: ["createdAt"],
  company: ["createdAt"],
  activity: ["createdAt", "dueAt"],
  quotation: ["createdAt", "validUntil"],
};
/** Kolom nilai yang dapat dijumlahkan (dikelompokkan per mata uang). */
export const SUM_FIELDS: Partial<Record<InsightEntity, string>> = {
  deal: "value",
  quotation: "total",
  lead: "budget",
};

/** Nilai status/tipe baku untuk filter. */
export const STATUS_VALUES: Record<InsightEntity, readonly string[]> = {
  lead: ["new", "contacted", "qualified", "unqualified"],
  deal: ["open", "won", "lost"],
  contact: [],
  company: [],
  activity: ["open", "done", "cancelled"],
  quotation: ["draft", "sent", "accepted", "rejected", "expired"],
};
export const ACTIVITY_TYPE_VALUES = [
  "task",
  "call",
  "meeting",
  "email",
  "note",
  "whatsapp",
] as const;

export const PERIOD_PRESETS = [
  "all",
  "today",
  "this_week",
  "this_month",
  "last_month",
  "last_30_days",
  "this_year",
  "last_year",
] as const;
export const PERIOD_LABEL: Record<(typeof PERIOD_PRESETS)[number], string> = {
  all: "sepanjang waktu",
  today: "hari ini",
  this_week: "minggu ini",
  this_month: "bulan ini",
  last_month: "bulan lalu",
  last_30_days: "30 hari terakhir",
  this_year: "tahun ini",
  last_year: "tahun lalu",
};

export const planSchema = z
  .object({
    entity: z.enum(INSIGHT_ENTITIES),
    metric: z.enum(["count", "sum", "list"]),
    filters: z
      .array(z.object({ field: z.string().max(20), value: z.string().trim().min(1).max(80) }))
      .max(5)
      .default([]),
    period: z
      .object({ field: z.string().max(20), preset: z.enum(PERIOD_PRESETS) })
      .default({ field: "createdAt", preset: "all" }),
    groupBy: z.string().max(20).nullable().default(null),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict()
  .superRefine((p, ctx) => {
    const bad = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    for (const f of p.filters)
      if (!FILTER_FIELDS[p.entity].includes(f.field))
        bad("filters", `Filter "${f.field}" tidak tersedia untuk ${p.entity}`);
    if (p.groupBy && !GROUP_FIELDS[p.entity].includes(p.groupBy))
      bad("groupBy", `Pengelompokan "${p.groupBy}" tidak tersedia`);
    if (!PERIOD_FIELDS[p.entity].includes(p.period.field))
      bad("period", `Periode "${p.period.field}" tidak tersedia`);
    if (p.metric === "sum" && !SUM_FIELDS[p.entity])
      bad("metric", `${p.entity} tidak memiliki nilai yang dapat dijumlahkan`);
  });
export type InsightPlan = z.output<typeof planSchema>;

/** Skema untuk dipakai model (structured output): longgar pada string, divalidasi ketat setelahnya. */
export const planDraftSchema = z.object({
  entity: z.string(),
  metric: z.string(),
  filters: z.array(z.object({ field: z.string(), value: z.string() })),
  period: z.object({ field: z.string(), preset: z.string() }),
  groupBy: z.string().nullable(),
  limit: z.number().nullable(),
});

export function describeSchemaForPrompt() {
  return INSIGHT_ENTITIES.map(
    (e) =>
      `- ${e}: filter=[${FILTER_FIELDS[e].join(", ")}]; groupBy=[${GROUP_FIELDS[e].join(", ")}]; period.field=[${PERIOD_FIELDS[e].join(", ")}]; sum=${SUM_FIELDS[e] ?? "tidak ada"}`,
  ).join("\n");
}
