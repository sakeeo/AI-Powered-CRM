import type { TenantContext } from "@/lib/context";
import { DEFAULT_PIPELINE_NAME, DEFAULT_STAGES } from "@/modules/deals/constants";

type Db = TenantContext["db"];

/**
 * Pipeline default organisasi (idempoten). Dibuat saat onboarding dan lazily untuk organisasi
 * yang dibuat sebelum fitur ini / lewat API langsung.
 */
export async function ensureDefaultPipeline(db: Db) {
  const existing = await db.pipeline.findFirst({
    where: { isDefault: true, archivedAt: null },
    include: { stages: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
  });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const p = await tx.pipeline.create({
      data: { name: DEFAULT_PIPELINE_NAME, isDefault: true } as never,
    });
    await tx.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i + 1, pipelineId: p.id })) as never,
    });
    return tx.pipeline.findUniqueOrThrow({
      where: { id: p.id },
      include: { stages: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
    });
  });
}
