import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { DEAL_SORTS } from "@/modules/deals/constants";
import { DealsTable } from "@/modules/deals/components/deals-table";
import { PipelineSummary } from "@/modules/deals/components/pipeline-summary";
import { getDefaultPipeline, listDeals, pipelineSummary } from "@/modules/deals/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Deals & Pipelines" };

export default async function Page(props: PageProps<"/deals">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, DEAL_SORTS, "createdAt");
  const filters = {
    stageId: pickParam(sp, "stage"),
    status: pickParam(sp, "status"),
    owner: pickParam(sp, "owner"),
  };
  const pipeline = await getDefaultPipeline(ctx);
  const [data, summary, contacts, companies, owners, org] = await Promise.all([
    listDeals(ctx, params, filters),
    pipelineSummary(ctx, pipeline.id),
    listContactOptions(ctx),
    listCompanyOptions(ctx),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  return (
    <div className="space-y-4">
      <PipelineSummary stages={summary} defaultCurrency={org.defaultCurrency} />
      <DealsTable
        table={{
          data: data.rows,
          total: data.total,
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          dir: params.dir,
          q: params.q,
        }}
        contacts={contacts}
        companies={companies}
        stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name }))}
        owners={owners}
        canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
        defaultCurrency={org.defaultCurrency}
      />
    </div>
  );
}
