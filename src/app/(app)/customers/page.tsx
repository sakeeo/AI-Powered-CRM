import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { CustomersTable } from "@/modules/customers/components/customers-table";
import { CUSTOMER_SORTS } from "@/modules/customers/schemas";
import { DynamicSegmentsPanel } from "@/modules/customers/components/dynamic-segments-panel";
import {
  listCustomers,
  listDynamicSegments,
  listSegments,
} from "@/modules/customers/server/queries";

export const metadata: Metadata = { title: "Customers" };

export default async function Page(props: PageProps<"/customers">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Customer")) return <Forbidden what="customer" />;
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, CUSTOMER_SORTS, "lastWonAt");
  const [data, segments, dynamic, tags] = await Promise.all([
    listCustomers(ctx, params, {
      type: pickParam(sp, "type"),
      segmentId: pickParam(sp, "segment"),
    }),
    listSegments(ctx),
    listDynamicSegments(ctx),
    ctx.db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-4">
      <DynamicSegmentsPanel
        segments={dynamic}
        tags={tags}
        canManage={["owner", "admin", "sales_manager"].includes(ctx.role)}
      />
      <CustomersTable
        table={{
          data: data.rows,
          total: data.total,
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          dir: params.dir,
          q: params.q,
        }}
        segments={segments}
      />
    </div>
  );
}
