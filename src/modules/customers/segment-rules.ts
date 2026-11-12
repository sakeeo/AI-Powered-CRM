import { z } from "zod";

/**
 * Aturan segmen dinamis (plan 2.6): kombinasi AND dari kriteria tag, nilai, dan recency.
 * "Nilai" = total deal Won dalam mata uang default organisasi (mata uang lain tidak dijumlahkan).
 */
export const segmentRulesSchema = z
  .object({
    party: z.enum(["all", "company", "contact"]).default("all"),
    minTotal: z.number().min(0).max(1e15).optional(),
    maxTotal: z.number().min(0).max(1e15).optional(),
    minWonCount: z.number().int().min(1).max(10_000).optional(),
    /** Terakhir membeli dalam N hari terakhir */
    wonWithinDays: z.number().int().min(1).max(3650).optional(),
    /** Tidak membeli selama ≥ N hari (pelanggan "tidur") */
    inactiveDays: z.number().int().min(1).max(3650).optional(),
    /** Punya salah satu tag ini */
    tagIds: z.array(z.uuid()).max(20).optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.minTotal !== undefined && r.maxTotal !== undefined && r.minTotal > r.maxTotal)
      ctx.addIssue({
        code: "custom",
        path: ["maxTotal"],
        message: "Nilai maksimum harus ≥ minimum",
      });
    if (r.wonWithinDays !== undefined && r.inactiveDays !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["inactiveDays"],
        message: "Pilih salah satu: aktif terakhir N hari atau tidak aktif N hari",
      });
    const any =
      r.party !== "all" ||
      r.minTotal !== undefined ||
      r.maxTotal !== undefined ||
      r.minWonCount !== undefined ||
      r.wonWithinDays !== undefined ||
      r.inactiveDays !== undefined ||
      (r.tagIds?.length ?? 0) > 0;
    if (!any)
      ctx.addIssue({ code: "custom", path: ["party"], message: "Tambahkan minimal satu kriteria" });
  });
export type SegmentRules = z.output<typeof segmentRulesSchema>;

export type RuleSubject = {
  type: "company" | "contact";
  wonCount: number;
  totals: Record<string, string>;
  lastWonAt: Date | null;
  tagIds: ReadonlySet<string>;
};

/** Evaluasi murni satu customer terhadap aturan (AND). */
export function matchesRules(
  s: RuleSubject,
  r: SegmentRules,
  opts: { defaultCurrency: string; now: Date },
): boolean {
  if (r.party !== "all" && s.type !== r.party) return false;
  const total = Number(s.totals[opts.defaultCurrency] ?? 0);
  if (r.minTotal !== undefined && total < r.minTotal) return false;
  if (r.maxTotal !== undefined && total > r.maxTotal) return false;
  if (r.minWonCount !== undefined && s.wonCount < r.minWonCount) return false;
  const ageDays = s.lastWonAt
    ? (opts.now.getTime() - s.lastWonAt.getTime()) / 86_400_000
    : Infinity;
  if (r.wonWithinDays !== undefined && !(ageDays <= r.wonWithinDays)) return false;
  if (r.inactiveDays !== undefined && !(ageDays >= r.inactiveDays)) return false;
  if (r.tagIds?.length && !r.tagIds.some((t) => s.tagIds.has(t))) return false;
  return true;
}

export function describeRules(r: SegmentRules, tagNames: Map<string, string> = new Map()): string {
  const p: string[] = [];
  if (r.party !== "all") p.push(r.party === "company" ? "hanya company" : "hanya contact");
  if (r.minTotal !== undefined) p.push(`total ≥ ${r.minTotal.toLocaleString("id-ID")}`);
  if (r.maxTotal !== undefined) p.push(`total ≤ ${r.maxTotal.toLocaleString("id-ID")}`);
  if (r.minWonCount !== undefined) p.push(`≥ ${r.minWonCount} deal Won`);
  if (r.wonWithinDays !== undefined) p.push(`membeli dalam ${r.wonWithinDays} hari terakhir`);
  if (r.inactiveDays !== undefined) p.push(`tidak membeli ≥ ${r.inactiveDays} hari`);
  if (r.tagIds?.length) p.push(`tag: ${r.tagIds.map((t) => tagNames.get(t) ?? "?").join(" / ")}`);
  return p.join(" · ");
}

const segmentBase = {
  name: z.string().trim().min(2, "Nama segmen minimal 2 karakter").max(40),
  rules: segmentRulesSchema,
};
export const createDynamicSegmentSchema = z.object(segmentBase);
export const updateDynamicSegmentSchema = z.object({ id: z.uuid(), ...segmentBase });
