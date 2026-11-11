import type { Metadata } from "next";
import { asSubject } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { orNotFound } from "@/lib/not-found";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { listActiveProducts } from "@/modules/products/server/queries";
import { QuotationBuilder } from "@/modules/quotations/components/quotation-builder";
import { getQuotation } from "@/modules/quotations/server/queries";

export const metadata: Metadata = { title: "Detail quotation" };

export default async function Page(props: PageProps<"/quotations/[id]">) {
  const ctx = await requireTenant();
  const { id } = await props.params;
  const [q, products, contacts, companies] = await Promise.all([
    orNotFound(getQuotation(ctx, id)),
    listActiveProducts(ctx),
    listContactOptions(ctx),
    listCompanyOptions(ctx),
  ]);
  const subject = asSubject("Quotation", q);
  return (
    <QuotationBuilder
      q={q}
      products={products}
      contacts={contacts}
      companies={companies}
      canEdit={ctx.ability.can("update", subject)}
      canDelete={ctx.ability.can("delete", subject)}
    />
  );
}
