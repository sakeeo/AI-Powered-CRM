import { z } from "zod";
import { planSchema } from "@/modules/insights/plan";

export const REPORT_FREQUENCIES = ["none", "daily", "weekly", "monthly"] as const;
export const FREQUENCY_LABEL: Record<(typeof REPORT_FREQUENCIES)[number], string> = {
  none: "Tidak dijadwalkan",
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};
export const WEEKDAY_LABEL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export const runReportSchema = z.object({ definition: planSchema });
export const saveReportSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(80),
  definition: planSchema,
  visibility: z.enum(["personal", "organization"]).default("personal"),
});
export const scheduleReportSchema = z
  .object({
    id: z.uuid(),
    frequency: z.enum(REPORT_FREQUENCIES),
    weekday: z.number().int().min(1).max(7).optional(),
    monthday: z.number().int().min(1).max(28).optional(),
    hour: z.number().int().min(0).max(23).default(8),
    recipientIds: z.array(z.uuid()).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.frequency !== "none" && v.recipientIds.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["recipientIds"],
        message: "Pilih minimal satu penerima",
      });
    if (v.frequency === "weekly" && !v.weekday)
      ctx.addIssue({ code: "custom", path: ["weekday"], message: "Pilih hari" });
    if (v.frequency === "monthly" && !v.monthday)
      ctx.addIssue({ code: "custom", path: ["monthday"], message: "Pilih tanggal" });
  });
