import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { ContactsTable } from "@/modules/contacts/components/contacts-table";
import { CONTACT_SORTS } from "@/modules/contacts/schemas";
import { listCompanyOptions, listContacts } from "@/modules/contacts/server/queries";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Contacts" };

export default async function Page(props: PageProps<"/contacts">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, CONTACT_SORTS, "createdAt");
  const [data, companies, owners] = await Promise.all([
    listContacts(ctx, params, { ownerId: pickParam(sp, "owner") }),
    listCompanyOptions(ctx),
    listOwnerOptions(ctx),
  ]);
  return (
    <ContactsTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      companies={companies}
      owners={owners}
      canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
    />
  );
}
