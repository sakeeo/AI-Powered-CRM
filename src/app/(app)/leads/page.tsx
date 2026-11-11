import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { LEAD_SORTS } from "@/modules/leads/constants";
import { LeadsTable } from "@/modules/leads/components/leads-table";
import { listLeadSources, listLeads } from "@/modules/leads/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Leads" };

export default async function Page(props: PageProps<"/leads">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, LEAD_SORTS, "createdAt");
  const archived = pickParam(sp, "archived") === "1";
  const [data, sources, owners, org] = await Promise.all([
    listLeads(ctx, params, {
      status: pickParam(sp, "status"),
      sourceId: pickParam(sp, "source"),
      owner: pickParam(sp, "owner"),
      archived,
    }),
    listLeadSources(ctx, { activeOnly: true }),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  return (
    <LeadsTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      sources={sources.map((s) => ({ id: s.id, name: s.name }))}
      owners={owners}
      canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
      defaultCurrency={org.defaultCurrency}
      archived={archived}
    />
  );
}
