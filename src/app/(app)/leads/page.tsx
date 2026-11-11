import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { LEAD_SORTS } from "@/modules/leads/constants";
import { ExportButton } from "@/modules/import-export/components/export-button";
import { ImportLeadsDialog } from "@/modules/import-export/components/import-leads-dialog";
import { TextToLeadDialog } from "@/modules/leads/components/text-to-lead-dialog";
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
  const sourceOptions = sources.map((s) => ({ id: s.id, name: s.name }));
  const canAssignOwner = ctx.role !== "sales_rep" && ctx.role !== "viewer";
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
      sources={sourceOptions}
      owners={owners}
      canAssignOwner={canAssignOwner}
      defaultCurrency={org.defaultCurrency}
      archived={archived}
      actions={
        <>
          {ctx.ability.can("create", "Lead") && !archived && (
            <>
              <TextToLeadDialog
                sources={sourceOptions}
                owners={owners}
                canAssignOwner={canAssignOwner}
                defaultCurrency={org.defaultCurrency}
              />
              <ImportLeadsDialog
                sources={sourceOptions}
                owners={owners}
                canAssignOwner={canAssignOwner}
              />
            </>
          )}
          <ExportButton entity="leads" />
        </>
      }
    />
  );
}
