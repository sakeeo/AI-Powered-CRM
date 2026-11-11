import type { Metadata } from "next";
import Link from "next/link";
import { PageActions } from "@/components/shared/page-actions";
import { Button } from "@/components/ui/button";
import { UrlFilterSelect } from "@/components/shared/data-table";
import { KanbanBoard } from "@/modules/deals/components/kanban-board";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { DEAL_SORTS } from "@/modules/deals/constants";
import { DealsTable } from "@/modules/deals/components/deals-table";
import { PipelineSummary } from "@/modules/deals/components/pipeline-summary";
import {
  getDefaultPipeline,
  getKanban,
  listDeals,
  periodRange,
  pipelineSummary,
} from "@/modules/deals/server/queries";
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
  const view = pickParam(sp, "view") === "board" ? "board" : "list";
  const viewSwitch = (
    <div className="flex gap-2">
      <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
        <Link href="/deals">Daftar</Link>
      </Button>
      <Button asChild variant={view === "board" ? "default" : "outline"} size="sm">
        <Link href="/deals?view=board">Papan</Link>
      </Button>
    </div>
  );
  if (view === "board") {
    const filters = { owner: pickParam(sp, "owner"), ...periodRange(pickParam(sp, "period")) };
    const [board, owners, org] = await Promise.all([
      getKanban(ctx, pipeline.id, filters),
      listOwnerOptions(ctx),
      getOrganization(ctx),
    ]);
    return (
      <div className="space-y-4">
        <PageActions>
          {viewSwitch}
          <UrlFilterSelect
            param="owner"
            label="Filter owner"
            allLabel="Semua owner"
            options={[
              { value: "unassigned", label: "Belum ditugaskan" },
              ...owners.map((o) => ({ value: o.userId, label: o.name })),
            ]}
          />
          <UrlFilterSelect
            param="period"
            label="Filter periode closing"
            allLabel="Semua periode"
            options={[
              { value: "overdue", label: "Terlambat" },
              { value: "30d", label: "30 hari ke depan" },
              { value: "90d", label: "90 hari ke depan" },
            ]}
          />
        </PageActions>
        <PipelineSummary stages={board.summary} defaultCurrency={org.defaultCurrency} />
        <KanbanBoard
          stages={board.summary}
          cards={board.cards}
          truncated={board.truncated}
          ownerNames={Object.fromEntries(owners.map((o) => [o.userId, o.name]))}
        />
      </div>
    );
  }
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
      <PageActions>{viewSwitch}</PageActions>
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
