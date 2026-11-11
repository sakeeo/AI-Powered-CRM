import type { ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan, resolveOwner } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { AppError, NotFoundError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { normalizePhone } from "@/lib/phone";
import { findCompanyDuplicates, findContactDuplicates } from "@/modules/duplicates/server/detect";
import type { ConvertLeadData } from "@/modules/leads/schemas";
import { ensureDefaultPipeline } from "@/modules/deals/server/pipeline";

/** Saran pencocokan untuk dialog konversi: contact/company yang sudah ada dan mirip dengan lead. */
export async function getConversionSuggestions(ctx: TenantContext, leadId: string) {
  const lead = await ctx.db.lead.findFirst({ where: { id: leadId } });
  if (!lead) throw NotFoundError("Lead");
  assertCan(ctx, "view", "Lead", lead);
  const contacts = ctx.ability.can("view", "Contact")
    ? await findContactDuplicates(ctx, {
        name: lead.name,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
      })
    : [];
  const companies =
    lead.companyName && ctx.ability.can("view", "Company")
      ? await findCompanyDuplicates(ctx, { name: lead.companyName })
      : [];
  return { contacts, companies };
}

/**
 * Konversi lead → contact/company/deal dalam SATU transaksi database: bila salah satu langkah
 * gagal, tidak ada record baru yang tersisa dan lead tidak berubah.
 * Mencocokkan (link) record yang sudah ada atau membuat baru — keputusan ada di user.
 */
export async function convertLeadService(ctx: ActionContext, input: ConvertLeadData) {
  const lead = await ctx.db.lead.findFirst({ where: { id: input.leadId } });
  if (!lead) throw NotFoundError("Lead");
  assertCan(ctx, "update", "Lead", lead);
  if (lead.archivedAt) throw new AppError("Lead terarsip tidak dapat dikonversi");
  if (lead.convertedAt) throw new AppError("Lead ini sudah dikonversi");
  if (lead.status !== "qualified")
    throw new AppError("Lead harus berstatus Qualified sebelum dikonversi");

  const { contact, company, deal } = input;
  if (contact.mode === "none" && company.mode === "none") {
    throw new AppError("Pilih minimal contact atau company untuk hasil konversi");
  }
  if (contact.mode === "create") assertCan(ctx, "create", "Contact");
  if (company.mode === "create") {
    assertCan(ctx, "create", "Company");
    if (!lead.companyName)
      throw new AppError("Lead tidak memiliki nama perusahaan untuk dibuat menjadi company");
  }
  if (deal.create) assertCan(ctx, "create", "Deal");

  // Validasi sebelum transaksi: record yang di-link harus ada di tenant ini.
  if (
    contact.mode === "link" &&
    !(await ctx.db.contact.findFirst({ where: { id: contact.contactId, deletedAt: null } }))
  ) {
    throw new AppError("Contact yang dipilih tidak ditemukan");
  }
  if (
    company.mode === "link" &&
    !(await ctx.db.company.findFirst({ where: { id: company.companyId, deletedAt: null } }))
  ) {
    throw new AppError("Company yang dipilih tidak ditemukan");
  }
  const owner = lead.ownerId ?? resolveOwner(ctx);
  const pipeline = deal.create ? await ensureDefaultPipeline(ctx.db) : null;

  const result = await ctx.db.$transaction(async (tx) => {
    let contactId: string | null = null;
    let companyId: string | null = null;

    if (company.mode === "create") {
      const c = await tx.company.create({
        data: {
          name: lead.companyName!,
          ownerId: owner,
          createdBy: ctx.userId,
          organizationId: ctx.organizationId,
        },
      });
      companyId = c.id;
    } else if (company.mode === "link") {
      companyId = company.companyId;
    }

    if (contact.mode === "create") {
      const c = await tx.contact.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          phoneNormalized: normalizePhone(lead.phone),
          notes: lead.notes,
          ownerId: owner,
          createdBy: ctx.userId,
          organizationId: ctx.organizationId,
        },
      });
      contactId = c.id;
    } else if (contact.mode === "link") {
      contactId = contact.contactId;
    }

    if (contactId && companyId) {
      const exists = await tx.contactCompany.findFirst({ where: { contactId, companyId } });
      if (!exists) {
        const hasPrimary = await tx.contactCompany.count({ where: { contactId } });
        await tx.contactCompany.create({
          data: {
            contactId,
            companyId,
            isPrimary: hasPrimary === 0,
            organizationId: ctx.organizationId,
          },
        });
      }
    }

    let dealId: string | null = null;
    if (deal.create) {
      const stage = deal.stageId
        ? pipeline!.stages.find((s) => s.id === deal.stageId)
        : pipeline!.stages[0];
      if (!stage) throw new AppError("Stage tidak valid");
      const d = await tx.deal.create({
        data: {
          title: deal.title ?? `${lead.name} — ${lead.needs?.slice(0, 40) || "Peluang baru"}`,
          pipelineId: pipeline!.id,
          stageId: stage.id,
          value: toDecimal(deal.value ?? (lead.budget ? lead.budget.toFixed(2) : "0"))!,
          currency: deal.currency ?? lead.currency,
          expectedCloseDate: deal.expectedCloseDate
            ? new Date(`${deal.expectedCloseDate}T00:00:00Z`)
            : null,
          contactId,
          companyId,
          ownerId: owner,
          sourceLeadId: lead.id,
          createdBy: ctx.userId,
          organizationId: ctx.organizationId,
        },
      });
      dealId = d.id;
    }

    // Riwayat aktivitas lead ikut tertaut ke contact/company/deal hasil konversi.
    await tx.activity.updateMany({
      where: { leadId: lead.id },
      data: {
        ...(contactId ? { contactId } : {}),
        ...(companyId ? { companyId } : {}),
        ...(dealId ? { dealId } : {}),
      },
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        convertedAt: new Date(),
        convertedContactId: contactId,
        convertedCompanyId: companyId,
        convertedDealId: dealId,
        updatedBy: ctx.userId,
      },
    });
    return { contactId, companyId, dealId };
  });

  await writeAudit(ctx, {
    action: "lead.converted",
    entityType: "Lead",
    entityId: lead.id,
    before: { status: lead.status },
    after: result,
  });
  return result;
}
