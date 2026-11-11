"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan, scopeWhere } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { idInput } from "@/lib/schema-helpers";
import { dateInTz } from "@/lib/timezone";
import { getOrganization } from "@/modules/organizations/server/queries";
import { calculateQuotation, canTransition } from "@/modules/quotations/calc";
import {
  createQuotationSchema,
  quotationSettingsSchema,
  saveQuotationSchema,
  setQuotationStatusSchema,
} from "@/modules/quotations/schemas";
import { getQuotationSettings } from "@/modules/quotations/server/settings";

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

type Item = {
  productId?: string;
  name: string;
  description?: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
};

function totalsOf(
  items: Item[],
  q: { taxRate: string; taxInclusive: boolean; globalDiscountPercent: string },
) {
  const calc = calculateQuotation(items, {
    taxRate: q.taxRate,
    taxInclusive: q.taxInclusive,
    globalDiscountPercent: q.globalDiscountPercent,
  });
  return calc;
}

const itemRows = (items: Item[], calc: ReturnType<typeof totalsOf>) =>
  items.map((it, i) => ({
    position: i + 1,
    productId: it.productId ?? null,
    name: it.name,
    description: it.description ?? null,
    quantity: toDecimal(it.quantity)!,
    unitPrice: toDecimal(it.unitPrice)!,
    discountPercent: toDecimal(it.discountPercent)!,
    lineTotal: toDecimal(calc.lines[i].net)!,
  }));

async function nextNumber(ctx: ActionContext, year: string) {
  const last = await ctx.db.quotation.findFirst({
    where: { number: { startsWith: `QUO-${year}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const n = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `QUO-${year}-${String(n).padStart(4, "0")}`;
}

async function assertParties(ctx: ActionContext, contactId?: string, companyId?: string) {
  if (contactId && !(await ctx.db.contact.findFirst({ where: { id: contactId, deletedAt: null } })))
    throw new AppError("Contact tidak ditemukan");
  if (companyId && !(await ctx.db.company.findFirst({ where: { id: companyId, deletedAt: null } })))
    throw new AppError("Company tidak ditemukan");
}

/** Buat quotation draft; bila dari deal: customer & item produk deal disalin. */
export const createQuotation = tenantAction(createQuotationSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Quotation");
  const [settings, org] = await Promise.all([getQuotationSettings(ctx.db), getOrganization(ctx)]);
  let { contactId, companyId } = input;
  let title = input.title;
  let currency = org.defaultCurrency;
  let ownerId = ctx.userId;
  let items: Item[] = [];
  const dealId = input.dealId;

  if (dealId) {
    const deal = await ctx.db.deal.findFirst({
      where: { AND: [{ id: dealId, deletedAt: null }, scopeWhere(ctx, "view", "Deal")] } as never,
    });
    if (!deal) throw NotFoundError("Deal");
    contactId ??= deal.contactId ?? undefined;
    companyId ??= deal.companyId ?? undefined;
    title ??= `Penawaran — ${deal.title}`;
    currency = deal.currency;
    if (ctx.role !== "sales_rep" && deal.ownerId) ownerId = deal.ownerId;
    const dp = await ctx.db.dealProduct.findMany({
      where: { dealId },
      orderBy: { createdAt: "asc" },
    });
    items = dp.map((p) => ({
      productId: p.productId ?? undefined,
      name: p.name,
      quantity: String(p.quantity),
      unitPrice: p.unitPrice.toFixed(2),
      discountPercent: "0",
    }));
    currency = dp[0]?.currency ?? currency;
  }
  await assertParties(ctx, contactId, companyId);

  const issue = dateInTz(new Date(), org.timezone);
  const snap = {
    taxRate: settings.taxRate,
    taxInclusive: settings.taxInclusive,
    globalDiscountPercent: "0",
  };
  const calc = totalsOf(items, snap);
  const year = issue.slice(0, 4);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const q = await ctx.db.quotation.create({
        data: {
          number: await nextNumber(ctx, year),
          title: title ?? "Penawaran baru",
          dealId: dealId ?? null,
          contactId: contactId ?? null,
          companyId: companyId ?? null,
          ownerId,
          currency,
          issueDate: toDate(issue),
          validUntil: toDate(addDays(issue, settings.validityDays)),
          taxLabel: settings.taxLabel,
          taxRate: toDecimal(settings.taxRate)!,
          taxInclusive: settings.taxInclusive,
          subtotal: toDecimal(calc.subtotal)!,
          discountTotal: toDecimal(calc.discountTotal)!,
          taxTotal: toDecimal(calc.taxTotal)!,
          total: toDecimal(calc.total)!,
          terms: settings.terms,
          createdBy: ctx.userId,
          items: {
            create: itemRows(items, calc).map((r) => ({
              ...r,
              organizationId: ctx.organizationId,
            })),
          },
        } as never,
      });
      await writeAudit(ctx, {
        action: "quotation.created",
        entityType: "Quotation",
        entityId: q.id,
        after: { number: q.number, dealId, items: items.length },
      });
      revalidatePath("/quotations");
      if (dealId) revalidatePath(`/deals/${dealId}`);
      return { id: q.id };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
    }
  }
  throw new AppError("Gagal membuat nomor quotation");
});

async function load(ctx: ActionContext, id: string) {
  const q = await ctx.db.quotation.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw NotFoundError("Quotation");
  return q;
}

/** Simpan isi draft. Total SELALU dihitung ulang di server — angka dari klien tidak dipercaya. */
export const saveQuotation = tenantAction(saveQuotationSchema, async (ctx, input) => {
  const q = await load(ctx, input.id);
  assertCan(ctx, "update", "Quotation", q);
  if (q.status !== "draft") throw new AppError("Hanya quotation berstatus Draft yang dapat diubah");
  if (input.validUntil < q.issueDate.toISOString().slice(0, 10))
    throw new AppError("Masa berlaku tidak boleh sebelum tanggal terbit");
  await assertParties(ctx, input.contactId, input.companyId);
  for (const it of input.items) {
    if (
      it.productId &&
      !(await ctx.db.product.findFirst({ where: { id: it.productId, deletedAt: null } }))
    )
      throw new AppError("Produk pada item tidak ditemukan");
  }
  const calc = totalsOf(input.items as Item[], {
    taxRate: q.taxRate.toFixed(2),
    taxInclusive: q.taxInclusive,
    globalDiscountPercent: input.globalDiscountPercent,
  });
  await ctx.db.$transaction([
    ctx.db.quotationItem.deleteMany({ where: { quotationId: q.id } }),
    ctx.db.quotation.update({
      where: { id: q.id },
      data: {
        title: input.title,
        validUntil: toDate(input.validUntil),
        currency: input.currency,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        globalDiscountPercent: toDecimal(input.globalDiscountPercent)!,
        subtotal: toDecimal(calc.subtotal)!,
        discountTotal: toDecimal(calc.discountTotal)!,
        taxTotal: toDecimal(calc.taxTotal)!,
        total: toDecimal(calc.total)!,
        updatedBy: ctx.userId,
        items: {
          create: itemRows(input.items as Item[], calc).map((r) => ({
            ...r,
            organizationId: ctx.organizationId,
          })),
        },
      } as never,
    }),
  ]);
  await writeAudit(ctx, {
    action: "quotation.updated",
    entityType: "Quotation",
    entityId: q.id,
    before: { total: q.total.toFixed(2) },
    after: { total: calc.total, items: input.items.length },
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${q.id}`);
  return { total: calc.total };
});

export const setQuotationStatus = tenantAction(
  setQuotationStatusSchema,
  async (ctx, { id, status }) => {
    const q = await load(ctx, id);
    assertCan(ctx, "update", "Quotation", q);
    if (!canTransition(q.status, status))
      throw new AppError(`Status tidak dapat diubah dari ${q.status} ke ${status}`);
    if (status === "sent") {
      const count = await ctx.db.quotationItem.count({ where: { quotationId: id } });
      if (count === 0) throw new AppError("Tambahkan item sebelum menandai terkirim");
    }
    await ctx.db.quotation.update({
      where: { id },
      data: { status, sentAt: status === "sent" ? new Date() : q.sentAt, updatedBy: ctx.userId },
    });
    await writeAudit(ctx, {
      action: `quotation.${status}`,
      entityType: "Quotation",
      entityId: id,
      before: { status: q.status },
      after: { status },
    });
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
  },
);

export const deleteQuotation = tenantAction(idInput, async (ctx, { id }) => {
  const q = await load(ctx, id);
  assertCan(ctx, "delete", "Quotation", q);
  if (q.status !== "draft") throw new AppError("Hanya quotation Draft yang dapat dihapus");
  await ctx.db.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "quotation.deleted",
    entityType: "Quotation",
    entityId: id,
    before: { number: q.number },
  });
  revalidatePath("/quotations");
});

/** Pengaturan pajak/masa berlaku — hanya Owner/Admin. Berlaku untuk quotation baru (yang lama menyimpan snapshot). */
export const saveQuotationSettings = tenantAction(quotationSettingsSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Organization");
  const existing = await ctx.db.quotationSettings.findFirst();
  const data = { ...input, taxRate: toDecimal(input.taxRate)!, terms: input.terms ?? null };
  if (existing) await ctx.db.quotationSettings.update({ where: { id: existing.id }, data });
  else await ctx.db.quotationSettings.create({ data: data as never });
  await writeAudit(ctx, {
    action: "quotation_settings.updated",
    entityType: "QuotationSettings",
    before: existing
      ? { taxRate: existing.taxRate.toFixed(2), taxInclusive: existing.taxInclusive }
      : undefined,
    after: {
      taxLabel: input.taxLabel,
      taxRate: input.taxRate,
      taxInclusive: input.taxInclusive,
      validityDays: input.validityDays,
    },
  });
  revalidatePath("/settings/quotations");
});
