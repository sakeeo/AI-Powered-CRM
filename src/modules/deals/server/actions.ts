"use server";

import { revalidatePath } from "next/cache";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { emitAutomationEvent } from "@/lib/automation";
import { assertCan, resolveOwner } from "@/lib/authz";
import { AppError, NotFoundError } from "@/lib/errors";
import { toDecimal } from "@/lib/money-db";
import { idInput } from "@/lib/schema-helpers";
import {
  closeLostSchema,
  closeWonSchema,
  dealSchema,
  moveStageSchema,
  setLostCategorySchema,
  renamePipelineSchema,
  reorderStageSchema,
  stageSchema,
  updateDealSchema,
  updateStageSchema,
} from "@/modules/deals/schemas";
import { applyTags, prepareCustomFields } from "@/modules/customization/server/apply";
import { ensureDefaultPipeline } from "@/modules/deals/server/pipeline";
import { assertActiveMember } from "@/modules/organizations/server/queries";

const toDate = (s?: string) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function resolvePipelineStage(ctx: ActionContext, pipelineId?: string, stageId?: string) {
  const pipeline = pipelineId
    ? await ctx.db.pipeline.findFirst({
        where: { id: pipelineId, archivedAt: null },
        include: { stages: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
      })
    : await ensureDefaultPipeline(ctx.db);
  if (!pipeline) throw new AppError("Pipeline tidak ditemukan");
  const stage = stageId ? pipeline.stages.find((s) => s.id === stageId) : pipeline.stages[0];
  if (!stage) throw new AppError("Stage tidak valid untuk pipeline ini");
  return { pipelineId: pipeline.id, stageId: stage.id };
}

async function assertParties(ctx: ActionContext, contactId?: string, companyId?: string) {
  if (
    contactId &&
    !(await ctx.db.contact.findFirst({ where: { id: contactId, deletedAt: null } }))
  ) {
    throw new AppError("Contact tidak ditemukan");
  }
  if (
    companyId &&
    !(await ctx.db.company.findFirst({ where: { id: companyId, deletedAt: null } }))
  ) {
    throw new AppError("Company tidak ditemukan");
  }
}

export const createDeal = tenantAction(dealSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Deal");
  const {
    value,
    ownerId: requested,
    pipelineId,
    stageId,
    expectedCloseDate,
    customFields,
    tagIds,
    ...data
  } = input;
  const ownerId = resolveOwner(ctx, requested);
  if (ownerId !== ctx.userId) await assertActiveMember(ctx, ownerId);
  await assertParties(ctx, data.contactId, data.companyId);
  const place = await resolvePipelineStage(ctx, pipelineId, stageId);
  const cf = await prepareCustomFields(ctx, "deal", customFields);
  const deal = await ctx.db.deal.create({
    data: {
      ...data,
      customFields: cf,
      ...place,
      value: toDecimal(value ?? "0")!,
      expectedCloseDate: toDate(expectedCloseDate),
      ownerId,
      createdBy: ctx.userId,
    } as never,
  });
  if (tagIds?.length) await applyTags(ctx, "deal", deal.id, tagIds);
  await writeAudit(ctx, {
    action: "deal.created",
    entityType: "Deal",
    entityId: deal.id,
    after: { title: deal.title, value: value ?? "0", currency: data.currency, ownerId },
  });
  revalidatePath("/deals");
  return { id: deal.id };
});

export const updateDeal = tenantAction(updateDealSchema, async (ctx, input) => {
  const {
    id,
    value,
    ownerId: requested,
    pipelineId,
    stageId,
    expectedCloseDate,
    customFields,
    tagIds,
    ...data
  } = input;
  const existing = await ctx.db.deal.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Deal");
  assertCan(ctx, "update", "Deal", existing);
  if (existing.status !== "open") throw new AppError("Deal yang sudah ditutup tidak dapat diubah");
  const ownerId = ctx.role === "sales_rep" ? existing.ownerId : (requested ?? existing.ownerId);
  if (ownerId && ownerId !== existing.ownerId) await assertActiveMember(ctx, ownerId);
  await assertParties(ctx, data.contactId, data.companyId);
  // Perpindahan stage lewat moveDealStage; di sini stage hanya dipertahankan.
  void pipelineId;
  void stageId;
  const cf = customFields
    ? await prepareCustomFields(ctx, "deal", customFields, existing.customFields)
    : undefined;
  await ctx.db.deal.update({
    where: { id },
    data: {
      ...data,
      ...(cf ? { customFields: cf } : {}),
      contactId: data.contactId ?? null,
      companyId: data.companyId ?? null,
      probability: data.probability ?? null,
      value: toDecimal(value ?? "0")!,
      expectedCloseDate: toDate(expectedCloseDate),
      ownerId,
      updatedBy: ctx.userId,
    },
  });
  if (tagIds) await applyTags(ctx, "deal", id, tagIds);
  await writeAudit(ctx, {
    action: "deal.updated",
    entityType: "Deal",
    entityId: id,
    before: {
      title: existing.title,
      value: existing.value.toFixed(2),
      currency: existing.currency,
      ownerId: existing.ownerId,
    },
    after: { title: data.title, value: value ?? "0", currency: data.currency, ownerId },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
});

/** Pindah stage deal terbuka; setiap perpindahan dicatat di DealStageHistory (siapa, kapan, dari → ke). */
export const moveDealStage = tenantAction(moveStageSchema, async (ctx, { id, stageId }) => {
  const deal = await ctx.db.deal.findFirst({ where: { id, deletedAt: null } });
  if (!deal) throw NotFoundError("Deal");
  assertCan(ctx, "update", "Deal", deal);
  if (deal.status !== "open")
    throw new AppError("Deal yang sudah ditutup tidak dapat dipindah stage");
  const stage = await ctx.db.pipelineStage.findFirst({
    where: { id: stageId, pipelineId: deal.pipelineId, archivedAt: null },
  });
  if (!stage) throw new AppError("Stage tidak valid untuk pipeline deal ini");
  if (stage.id === deal.stageId) return;
  await ctx.db.$transaction([
    ctx.db.deal.update({ where: { id }, data: { stageId, updatedBy: ctx.userId } }),
    ctx.db.dealStageHistory.create({
      data: {
        dealId: id,
        fromStageId: deal.stageId,
        toStageId: stageId,
        changedBy: ctx.userId,
        organizationId: ctx.organizationId,
      },
    }),
  ]);
  await writeAudit(ctx, {
    action: "deal.stage_changed",
    entityType: "Deal",
    entityId: id,
    before: { stageId: deal.stageId },
    after: { stageId },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
});

async function loadOpenDeal(ctx: ActionContext, id: string) {
  const deal = await ctx.db.deal.findFirst({ where: { id, deletedAt: null } });
  if (!deal) throw NotFoundError("Deal");
  assertCan(ctx, "update", "Deal", deal);
  return deal;
}

/** Tandai deal Won (outcome terminal; bukan stage). */
export const markDealWon = tenantAction(closeWonSchema, async (ctx, { id }) => {
  const deal = await loadOpenDeal(ctx, id);
  if (deal.status !== "open") throw new AppError("Deal sudah ditutup");
  const closedAt = new Date();
  await ctx.db.deal.update({
    where: { id },
    data: { status: "won", closedAt, lostReason: null, updatedBy: ctx.userId },
  });
  await emitAutomationEvent(ctx.db, {
    organizationId: ctx.organizationId,
    trigger: "deal_won",
    entityId: id,
    eventKey: `deal_won:${id}:${closedAt.getTime()}`,
  });
  await writeAudit(ctx, {
    action: "deal.won",
    entityType: "Deal",
    entityId: id,
    before: { status: "open" },
    after: { status: "won", value: deal.value.toFixed(2), currency: deal.currency },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
});

/** Tandai deal Lost — alasan wajib (kategori diisi otomatis di plan 1.18). */
export const markDealLost = tenantAction(closeLostSchema, async (ctx, { id, reason, category }) => {
  const deal = await loadOpenDeal(ctx, id);
  if (deal.status !== "open") throw new AppError("Deal sudah ditutup");
  await ctx.db.deal.update({
    where: { id },
    data: {
      status: "lost",
      closedAt: new Date(),
      lostReason: reason,
      lostCategory: category ?? null,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "deal.lost",
    entityType: "Deal",
    entityId: id,
    before: { status: "open" },
    after: { status: "lost", reason, category },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
});

/** User mengonfirmasi/mengubah kategori alasan Lost (usulan AI tidak pernah final dengan sendirinya). */
export const setLostCategory = tenantAction(
  setLostCategorySchema,
  async (ctx, { id, category }) => {
    const deal = await loadOpenDeal(ctx, id);
    if (deal.status !== "lost") throw new AppError("Hanya deal Lost yang punya kategori alasan");
    await ctx.db.deal.update({
      where: { id },
      data: { lostCategory: category, updatedBy: ctx.userId },
    });
    await writeAudit(ctx, {
      action: "deal.lost_category_set",
      entityType: "Deal",
      entityId: id,
      before: { category: deal.lostCategory },
      after: { category },
    });
    revalidatePath(`/deals/${id}`);
  },
);

/** Buka kembali deal yang sudah ditutup (mis. salah klik). */
export const reopenDeal = tenantAction(closeWonSchema, async (ctx, { id }) => {
  const deal = await loadOpenDeal(ctx, id);
  if (deal.status === "open") throw new AppError("Deal masih terbuka");
  await ctx.db.deal.update({
    where: { id },
    data: {
      status: "open",
      closedAt: null,
      lostReason: null,
      lostCategory: null,
      updatedBy: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    action: "deal.reopened",
    entityType: "Deal",
    entityId: id,
    before: { status: deal.status },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
});

export const deleteDeal = tenantAction(idInput, async (ctx, { id }) => {
  const existing = await ctx.db.deal.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw NotFoundError("Deal");
  assertCan(ctx, "delete", "Deal", existing);
  await ctx.db.deal.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: "deal.deleted",
    entityType: "Deal",
    entityId: id,
    before: { title: existing.title },
  });
  revalidatePath("/deals");
});

// ---------------------------------------------------------------------------
// Konfigurasi pipeline & stage (Settings) — butuh izin ubah Pipeline.
// ---------------------------------------------------------------------------
async function loadStage(ctx: ActionContext, id: string) {
  const s = await ctx.db.pipelineStage.findFirst({ where: { id, archivedAt: null } });
  if (!s) throw NotFoundError("Stage");
  return s;
}

export const createStage = tenantAction(stageSchema, async (ctx, input) => {
  assertCan(ctx, "update", "Pipeline");
  const pipeline = await ensureDefaultPipeline(ctx.db);
  const last = pipeline.stages.at(-1)?.position ?? 0;
  const s = await ctx.db.pipelineStage.create({
    data: { ...input, pipelineId: pipeline.id, position: last + 1 } as never,
  });
  await writeAudit(ctx, {
    action: "pipeline_stage.created",
    entityType: "PipelineStage",
    entityId: s.id,
    after: input,
  });
  revalidatePath("/settings/pipelines");
});

export const updateStage = tenantAction(updateStageSchema, async (ctx, { id, ...input }) => {
  assertCan(ctx, "update", "Pipeline");
  const s = await loadStage(ctx, id);
  await ctx.db.pipelineStage.update({ where: { id }, data: input });
  await writeAudit(ctx, {
    action: "pipeline_stage.updated",
    entityType: "PipelineStage",
    entityId: id,
    before: { name: s.name, probability: s.probability },
    after: input,
  });
  revalidatePath("/settings/pipelines");
});

/** Tukar posisi dengan stage tetangga (urutan stage). */
export const reorderStage = tenantAction(reorderStageSchema, async (ctx, { id, direction }) => {
  assertCan(ctx, "update", "Pipeline");
  const s = await loadStage(ctx, id);
  const siblings = await ctx.db.pipelineStage.findMany({
    where: { pipelineId: s.pipelineId, archivedAt: null },
    orderBy: { position: "asc" },
  });
  const i = siblings.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  const other = siblings[j];
  await ctx.db.$transaction([
    ctx.db.pipelineStage.update({ where: { id: s.id }, data: { position: other.position } }),
    ctx.db.pipelineStage.update({ where: { id: other.id }, data: { position: s.position } }),
  ]);
  await writeAudit(ctx, {
    action: "pipeline_stage.reordered",
    entityType: "PipelineStage",
    entityId: id,
    after: { direction },
  });
  revalidatePath("/settings/pipelines");
});

/** Arsipkan stage. Ditolak bila masih ada deal terbuka di dalamnya atau tinggal satu stage. */
export const archiveStage = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "update", "Pipeline");
  const s = await loadStage(ctx, id);
  const active = await ctx.db.pipelineStage.count({
    where: { pipelineId: s.pipelineId, archivedAt: null },
  });
  if (active <= 1) throw new AppError("Pipeline harus memiliki minimal satu stage");
  const open = await ctx.db.deal.count({ where: { stageId: id, status: "open", deletedAt: null } });
  if (open > 0) throw new AppError(`Masih ada ${open} deal terbuka di stage ini. Pindahkan dulu.`);
  await ctx.db.pipelineStage.update({ where: { id }, data: { archivedAt: new Date() } });
  await writeAudit(ctx, {
    action: "pipeline_stage.archived",
    entityType: "PipelineStage",
    entityId: id,
    before: { name: s.name },
  });
  revalidatePath("/settings/pipelines");
});

export const renamePipeline = tenantAction(renamePipelineSchema, async (ctx, { id, name }) => {
  assertCan(ctx, "update", "Pipeline");
  const p = await ctx.db.pipeline.findFirst({ where: { id, archivedAt: null } });
  if (!p) throw NotFoundError("Pipeline");
  await ctx.db.pipeline.update({ where: { id }, data: { name } });
  await writeAudit(ctx, {
    action: "pipeline.renamed",
    entityType: "Pipeline",
    entityId: id,
    before: { name: p.name },
    after: { name },
  });
  revalidatePath("/settings/pipelines");
});
