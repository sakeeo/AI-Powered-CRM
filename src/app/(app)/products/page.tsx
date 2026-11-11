import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { getOrganization } from "@/modules/organizations/server/queries";
import { ProductsTable } from "@/modules/products/components/products-table";
import { PRODUCT_SORTS } from "@/modules/products/schemas";
import { listCategories, listProducts } from "@/modules/products/server/queries";

export const metadata: Metadata = { title: "Products" };

export default async function Page(props: PageProps<"/products">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Product")) return <Forbidden what="produk" />;
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, PRODUCT_SORTS, "name", "asc");
  const [data, categories, org] = await Promise.all([
    listProducts(ctx, params, {
      status: pickParam(sp, "status"),
      categoryId: pickParam(sp, "category"),
    }),
    listCategories(ctx),
    getOrganization(ctx),
  ]);
  return (
    <ProductsTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      categories={categories}
      defaultCurrency={org.defaultCurrency}
    />
  );
}
