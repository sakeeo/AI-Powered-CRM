"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { computeNextRun } from "@/lib/report-schedule";
import { idInput } from "@/lib/schema-helpers";
import { executePlan } from "@/modules/insights/server/execute";
import {
  runReportSchema,
  saveReportSchema,
  scheduleReportSchema,
} from "@/modules/reports/saved-schemas";
import { assertActiveMember, getOrganization } from "@/modules/organizations/server/queries";

const MANAGERS = ["owner", "admin", "sales_manager"];

/** Pratinjau/jalankan definisi laporan dengan IZIN pengguna saat ini (read-only, ter-scope tenant). */
export const runCustomReport = tenantAction(runReportSchema, async (ctx, { definition }) => {
  assertCan(ctx, "view", "Report");
  const { timezone } = await getOrganization(ctx);
  return executePlan(ctx, definition, timezone);
});

async function ownReport(ctx: ActionContext, id: string) {
  const r = await ctx.db.savedReport.findFirst({ where: { id } });
  if (!r) throw NotFoundError("Laporan");
  if (r.ownerId !== ctx.userId && !["owner", "admin"].includes(ctx.role)) throw ForbiddenError();
  return r;
}

export const saveCustomReport = tenantAction(saveReportSchema, async (ctx, input) => {
  assertCan(ctx, "view", "Report");
  if (input.visibility === "organization" && !MANAGERS.includes(ctx.role))
    throw new AppError(
      "Hanya Owner, Admin, atau Sales Manager yang dapat membagikan ke organisasi",
      403,
      "forbidden",
    );
  if (input.id) {
    const existing = await ownReport(ctx, input.id);
    await ctx.db.savedReport.update({
      where: { id: input.id },
      data: {
        name: input.name,
        definition: input.definition,
        visibility: input.visibility,
        updatedBy: ctx.userId,
      } as never,
    });
    await writeAudit(ctx, {
      action: "saved_report.updated",
      entityType: "SavedReport",
      entityId: input.id,
      before: { name: existing.name },
      after: { name: input.name },
    });
    revalidatePath("/reports/builder");
    return { id: input.id };
  }
  const row = await ctx.db.savedReport.create({
    data: {
      name: input.name,
      definition: input.definition,
      visibility: input.visibility,
      ownerId: ctx.userId,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "saved_report.created",
    entityType: "SavedReport",
    entityId: row.id,
    after: { name: input.name, entity: input.definition.entity },
  });
  revalidatePath("/reports/builder");
  return { id: row.id };
});

export const deleteCustomReport = tenantAction(idInput, async (ctx, { id }) => {
  const r = await ownReport(ctx, id);
  await ctx.db.savedReport.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "saved_report.deleted",
    entityType: "SavedReport",
    entityId: id,
    before: { name: r.name },
  });
  revalidatePath("/reports/builder");
});

/**
 * Atur jadwal pengiriman email. Penerima harus anggota aktif organisasi (tidak ada email ke luar),
 * dan masing-masing menerima data sesuai izinnya sendiri saat dikirim.
 */
export const scheduleCustomReport = tenantAction(scheduleReportSchema, async (ctx, input) => {
  const r = await ownReport(ctx, input.id);
  if (input.frequency !== "none") assertCan(ctx, "export", "Report");
  for (const uid of new Set(input.recipientIds)) await assertActiveMember(ctx, uid);
  const { timezone } = await getOrganization(ctx);
  const nextRunAt = computeNextRun(
    {
      frequency: input.frequency,
      weekday: input.weekday ?? null,
      monthday: input.monthday ?? null,
      hour: input.hour,
    },
    new Date(),
    timezone,
  );
  await ctx.db.savedReport.update({
    where: { id: input.id },
    data: {
      frequency: input.frequency,
      weekday: input.frequency === "weekly" ? (input.weekday ?? null) : null,
      monthday: input.frequency === "monthly" ? (input.monthday ?? null) : null,
      hour: input.hour,
      recipientIds: [...new Set(input.recipientIds)],
      nextRunAt,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "saved_report.scheduled",
    entityType: "SavedReport",
    entityId: input.id,
    before: { frequency: r.frequency },
    after: { frequency: input.frequency, recipients: input.recipientIds.length, nextRunAt },
  });
  revalidatePath("/reports/builder");
  return { nextRunAt };
});
