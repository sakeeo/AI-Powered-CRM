"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { normalizePhone } from "@/lib/phone";
import {
  readValues,
  validateCustomValues,
  type CustomValues,
} from "@/modules/customization/custom-fields";
import { loadFieldDefs } from "@/modules/customization/server/queries";
import { CF_IMPORT_PREFIX, validateLeadRow } from "@/modules/import-export/mapping";
import { importLeadsBatchSchema } from "@/modules/import-export/schemas";
import { ensureLeadSources } from "@/modules/leads/server/queries";
import { assertActiveMember } from "@/modules/organizations/server/queries";

export type ImportRowError = { row: number; message: string };

/**
 * Impor lead per batch (klien memecah berkas besar → UI tidak terblokir, ada progres).
 * Validasi per baris memakai skema lead yang sama dengan form; baris salah dilaporkan dan dilewati,
 * baris valid dalam batch tetap tersimpan. Sales Rep selalu menjadi owner data yang ia impor.
 */
export const importLeadsBatch = tenantAction(importLeadsBatchSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Lead");
  await ensureLeadSources(ctx.db);
  if (input.sourceId) {
    const s = await ctx.db.leadSource.findFirst({ where: { id: input.sourceId, isActive: true } });
    if (!s) throw new AppError("Sumber lead tidak valid");
  }
  const ownerId = ctx.role === "sales_rep" ? ctx.userId : (input.ownerId ?? null);
  if (ownerId && ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);

  const defs = await loadFieldDefs(ctx.db, "lead", { activeOnly: true });
  const errors: ImportRowError[] = [];
  const data: Record<string, unknown>[] = [];
  input.rows.forEach((raw, i) => {
    const row = input.startRow + i;
    const res = validateLeadRow(raw);
    if (!res.success) {
      const msg = res.error.issues
        .map((x) => `${x.path.join(".") || "baris"}: ${x.message}`)
        .join("; ");
      errors.push({ row, message: msg });
      return;
    }
    // Custom field: kolom `cf:<key>`; multiselect dipisah titik koma.
    const cfRaw: CustomValues = {};
    for (const d of defs) {
      const v = raw[`${CF_IMPORT_PREFIX}${d.key}`];
      if (v === undefined || v.trim() === "") continue;
      cfRaw[d.key] =
        d.type === "multiselect"
          ? v
              .split(/[;,]/)
              .map((x) => x.trim())
              .filter(Boolean)
          : v.trim();
    }
    const cf = validateCustomValues(defs, cfRaw);
    const cfError = Object.values(cf.errors)[0];
    if (cfError) {
      errors.push({ row, message: cfError });
      return;
    }
    const { budget, ...rest } = res.data;
    data.push({
      ...rest,
      phoneNormalized: normalizePhone(rest.phone),
      budget: toDecimal(budget),
      customFields: readValues(cf.values),
      sourceId: input.sourceId ?? null,
      ownerId,
      createdBy: ctx.userId,
    });
  });
  if (data.length) await ctx.db.lead.createMany({ data: data as never });
  await writeAudit(ctx, {
    action: "lead.imported",
    entityType: "Lead",
    after: { created: data.length, rejected: errors.length, firstRow: input.startRow },
  });
  revalidatePath("/leads");
  return { created: data.length, errors };
});
