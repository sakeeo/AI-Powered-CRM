"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { scanOrgInsights } from "@/lib/insight-scan";
import { NotFoundError } from "@/lib/errors";

/** Abaikan anomali (hanya mengubah status alert itu sendiri). Sales Rep hanya milik pelanggannya. */
export const dismissInsightAlert = tenantAction(z.object({ id: z.uuid() }), async (ctx, { id }) => {
  assertCan(ctx, "view", "Report");
  const alert = await ctx.db.insightAlert.findFirst({
    where: { id, status: "open", ...(ctx.role === "sales_rep" ? { ownerId: ctx.userId } : {}) },
  });
  if (!alert) throw NotFoundError("Insight");
  await ctx.db.insightAlert.update({
    where: { id },
    data: { status: "dismissed", dismissedBy: ctx.userId, dismissedAt: new Date() },
  });
  await writeAudit(ctx, {
    action: "insight.dismissed",
    entityType: "InsightAlert",
    entityId: id,
  });
  revalidatePath("/intelligence");
  return {};
});

/** Pindai sekarang (Owner/Admin) — sama dengan job terjadwal, untuk organisasi sendiri. */
export const scanInsightsNow = tenantAction(z.object({}), async (ctx) => {
  assertCan(ctx, "manage", "Automation");
  const r = await scanOrgInsights(ctx.organizationId);
  revalidatePath("/intelligence");
  return r;
});
