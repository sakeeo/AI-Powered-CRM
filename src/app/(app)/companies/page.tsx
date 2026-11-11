import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { CompaniesTable } from "@/modules/companies/components/companies-table";
import { listCompanies } from "@/modules/companies/server/queries";
import { COMPANY_SORTS } from "@/modules/contacts/schemas";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Companies" };

export default async function Page(props: PageProps<"/companies">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, COMPANY_SORTS, "createdAt");
  const [data, owners] = await Promise.all([
    listCompanies(ctx, params, { ownerId: pickParam(sp, "owner") }),
    listOwnerOptions(ctx),
  ]);
  return (
    <CompaniesTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      owners={owners}
      canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
    />
  );
}
