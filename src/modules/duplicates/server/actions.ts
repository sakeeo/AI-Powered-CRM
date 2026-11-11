"use server";

import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { checkDuplicatesSchema, mergeSchema } from "@/modules/duplicates/schemas";
import {
  companyMergeHooks,
  contactMergeHooks,
  leadMergeHooks,
} from "@/modules/duplicates/server/merge-hooks";
import {
  findCompanyDuplicates,
  findContactDuplicates,
  findLeadDuplicates,
  type DuplicateMatch,
} from "@/modules/duplicates/server/detect";

/**
 * Deteksi duplikat dasar — HANYA memberi peringatan. Tidak pernah menggabung/menghapus otomatis.
 * Lead dicek terhadap lead dan contact; contact terhadap contact; company terhadap company.
 */
export const checkDuplicates = tenantAction(checkDuplicatesSchema, async (ctx, input) => {
  let matches: DuplicateMatch[] = [];
  if (input.entity === "contact") {
    assertCan(ctx, "view", "Contact");
    matches = await findContactDuplicates(ctx, input);
  } else if (input.entity === "company") {
    assertCan(ctx, "view", "Company");
    matches = await findCompanyDuplicates(ctx, input);
  } else {
    assertCan(ctx, "view", "Lead");
    matches = await findLeadDuplicates(ctx, input);
    if (ctx.ability.can("view", "Contact")) {
      matches = matches.concat(
        await findContactDuplicates(ctx, { ...input, companyIds: undefined }),
      );
    }
  }
  return matches.filter((m) => m.reasons.length > 0);
});

// ---------------------------------------------------------------------------
// Merge MANUAL: pengguna memilih record yang dipertahankan; yang digabung diarsipkan (soft),
// relasinya dipindahkan. Tidak ada auto-merge.
// ---------------------------------------------------------------------------
const FILL_CONTACT = ["email", "phone", "jobTitle", "address", "city", "country"] as const;
const FILL_COMPANY = [
  "industry",
  "website",
  "email",
  "phone",
  "address",
  "city",
  "country",
] as const;
const FILL_LEAD = ["email", "phone", "companyName", "needs", "urgency", "sourceId"] as const;

function fillFrom<T extends Record<string, unknown>>(keep: T, from: T, fields: readonly string[]) {
  const patch: Record<string, unknown> = {};
  for (const f of fields)
    if ((keep[f] === null || keep[f] === "") && from[f] != null && from[f] !== "")
      patch[f] = from[f];
  return patch;
}
const mergedNotes = (keep: string | null, from: string | null, fromName: string) =>
  from ? [keep, `— Digabung dari “${fromName}” —\n${from}`].filter(Boolean).join("\n\n") : keep;

function assertDifferent(keepId: string, mergeId: string) {
  if (keepId === mergeId) throw new AppError("Pilih dua record yang berbeda");
}

export const mergeContacts = tenantAction(
  mergeSchema,
  async (ctx, { keepId, mergeId, fillEmpty }) => {
    assertDifferent(keepId, mergeId);
    const [keep, dup] = await Promise.all([
      ctx.db.contact.findFirst({ where: { id: keepId, deletedAt: null } }),
      ctx.db.contact.findFirst({ where: { id: mergeId, deletedAt: null } }),
    ]);
    if (!keep || !dup) throw NotFoundError("Contact");
    assertCan(ctx, "update", "Contact", keep);
    assertCan(ctx, "update", "Contact", dup);
    assertCan(ctx, "delete", "Contact", dup);
    await ctx.db.$transaction(async (tx) => {
      const keepLinks = await tx.contactCompany.findMany({ where: { contactId: keepId } });
      const have = new Set(keepLinks.map((l) => l.companyId));
      const dupLinks = await tx.contactCompany.findMany({ where: { contactId: mergeId } });
      for (const l of dupLinks) {
        if (have.has(l.companyId)) await tx.contactCompany.delete({ where: { id: l.id } });
        else
          await tx.contactCompany.update({
            where: { id: l.id },
            data: { contactId: keepId, isPrimary: keepLinks.length === 0 && l.isPrimary },
          });
      }
      await tx.deal.updateMany({ where: { contactId: mergeId }, data: { contactId: keepId } });
      for (const h of contactMergeHooks) await h(tx as never, mergeId, keepId);
      await tx.contact.update({
        where: { id: keepId },
        data: {
          ...(fillEmpty ? fillFrom(keep, dup, FILL_CONTACT) : {}),
          phoneNormalized:
            (fillEmpty && !keep.phone && dup.phone ? dup.phoneNormalized : keep.phoneNormalized) ??
            null,
          notes: mergedNotes(keep.notes, dup.notes, dup.name),
          updatedBy: ctx.userId,
        },
      });
      await tx.contact.update({
        where: { id: mergeId },
        data: { deletedAt: new Date(), mergedIntoId: keepId, updatedBy: ctx.userId },
      });
    });
    await writeAudit(ctx, {
      action: "contact.merged",
      entityType: "Contact",
      entityId: keepId,
      before: { mergedId: mergeId, name: dup.name },
      after: { keepId },
    });
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${keepId}`);
  },
);

export const mergeCompanies = tenantAction(
  mergeSchema,
  async (ctx, { keepId, mergeId, fillEmpty }) => {
    assertDifferent(keepId, mergeId);
    const [keep, dup] = await Promise.all([
      ctx.db.company.findFirst({ where: { id: keepId, deletedAt: null } }),
      ctx.db.company.findFirst({ where: { id: mergeId, deletedAt: null } }),
    ]);
    if (!keep || !dup) throw NotFoundError("Company");
    assertCan(ctx, "update", "Company", keep);
    assertCan(ctx, "update", "Company", dup);
    assertCan(ctx, "delete", "Company", dup);
    await ctx.db.$transaction(async (tx) => {
      const have = new Set(
        (await tx.contactCompany.findMany({ where: { companyId: keepId } })).map(
          (l) => l.contactId,
        ),
      );
      for (const l of await tx.contactCompany.findMany({ where: { companyId: mergeId } })) {
        if (have.has(l.contactId)) await tx.contactCompany.delete({ where: { id: l.id } });
        else
          await tx.contactCompany.update({
            where: { id: l.id },
            data: { companyId: keepId, isPrimary: false },
          });
      }
      await tx.deal.updateMany({ where: { companyId: mergeId }, data: { companyId: keepId } });
      for (const h of companyMergeHooks) await h(tx as never, mergeId, keepId);
      await tx.company.update({
        where: { id: keepId },
        data: {
          ...(fillEmpty ? fillFrom(keep, dup, FILL_COMPANY) : {}),
          notes: mergedNotes(keep.notes, dup.notes, dup.name),
          updatedBy: ctx.userId,
        },
      });
      await tx.company.update({
        where: { id: mergeId },
        data: { deletedAt: new Date(), mergedIntoId: keepId, updatedBy: ctx.userId },
      });
    });
    await writeAudit(ctx, {
      action: "company.merged",
      entityType: "Company",
      entityId: keepId,
      before: { mergedId: mergeId, name: dup.name },
      after: { keepId },
    });
    revalidatePath("/companies");
    revalidatePath(`/companies/${keepId}`);
  },
);

export const mergeLeads = tenantAction(mergeSchema, async (ctx, { keepId, mergeId, fillEmpty }) => {
  assertDifferent(keepId, mergeId);
  const [keep, dup] = await Promise.all([
    ctx.db.lead.findFirst({ where: { id: keepId } }),
    ctx.db.lead.findFirst({ where: { id: mergeId } }),
  ]);
  if (!keep || !dup) throw NotFoundError("Lead");
  if (keep.archivedAt || dup.archivedAt) throw new AppError("Lead terarsip tidak dapat digabung");
  if (keep.convertedAt || dup.convertedAt)
    throw new AppError("Lead yang sudah dikonversi tidak dapat digabung");
  assertCan(ctx, "update", "Lead", keep);
  assertCan(ctx, "update", "Lead", dup);
  assertCan(ctx, "delete", "Lead", dup);
  await ctx.db.$transaction(async (tx) => {
    for (const h of leadMergeHooks) await h(tx as never, mergeId, keepId);
    await tx.lead.update({
      where: { id: keepId },
      data: {
        ...(fillEmpty ? fillFrom(keep, dup, FILL_LEAD) : {}),
        phoneNormalized:
          (fillEmpty && !keep.phone && dup.phone ? dup.phoneNormalized : keep.phoneNormalized) ??
          null,
        notes: mergedNotes(keep.notes, dup.notes, dup.name),
        updatedBy: ctx.userId,
      },
    });
    await tx.lead.update({
      where: { id: mergeId },
      data: { archivedAt: new Date(), mergedIntoId: keepId, updatedBy: ctx.userId },
    });
  });
  await writeAudit(ctx, {
    action: "lead.merged",
    entityType: "Lead",
    entityId: keepId,
    before: { mergedId: mergeId, name: dup.name },
    after: { keepId },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${keepId}`);
});
