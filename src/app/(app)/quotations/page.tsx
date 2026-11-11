import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { QuotationsTable } from "@/modules/quotations/components/quotations-table";
import { QUOTATION_SORTS } from "@/modules/quotations/schemas";
import { listDealOptions, listQuotations } from "@/modules/quotations/server/queries";

export const metadata: Metadata = { title: "Quotations" };

export default async function Page(props: PageProps<"/quotations">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Quotation")) return <Forbidden what="quotation" />;
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, QUOTATION_SORTS, "createdAt");
  const [data, deals, contacts, companies] = await Promise.all([
    listQuotations(ctx, params, { status: pickParam(sp, "status") }),
    listDealOptions(ctx),
    listContactOptions(ctx),
    listCompanyOptions(ctx),
  ]);
  return (
    <QuotationsTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      deals={deals}
      contacts={contacts}
      companies={companies}
    />
  );
}
