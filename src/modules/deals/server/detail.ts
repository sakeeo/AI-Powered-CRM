import type { TenantContext } from "@/lib/context";
import { getDeal } from "@/modules/deals/server/queries";

/** Deal + pipeline (beserta stage aktif) untuk halaman detail. */
export async function getDealOrThrow(ctx: TenantContext, id: string) {
  const deal = await getDeal(ctx, id);
  const pipeline = await ctx.db.pipeline.findFirstOrThrow({
    where: { id: deal.pipelineId },
    include: { stages: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
  });
  return { deal, pipeline };
}
