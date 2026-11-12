import type { Metadata } from "next";
import { CustomizationCard } from "@/modules/customization/components/customization-card";
import { getEntityCustomization } from "@/modules/customization/server/queries";
import { UnifiedTimeline } from "@/modules/omnichannel/components/unified-timeline";
import { getUnifiedTimeline } from "@/modules/omnichannel/server/timeline";
import { ActivitiesPanel } from "@/modules/activities/components/activities-panel";
import Link from "next/link";
import { DetailField } from "@/components/shared/detail-field";
import { RelatedDeals } from "@/modules/deals/components/related-deals";
import { listRelatedDeals } from "@/modules/deals/server/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asSubject } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { orNotFound } from "@/lib/not-found";
import { CompanyActions } from "@/modules/companies/components/company-actions";
import { getCompany } from "@/modules/companies/server/queries";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Detail company" };

export default async function Page(props: PageProps<"/companies/[id]">) {
  const ctx = await requireTenant();
  const { id } = await props.params;
  const [company, owners] = await Promise.all([
    orNotFound(getCompany(ctx, id)),
    listOwnerOptions(ctx),
  ]);
  const owner = owners.find((o) => o.userId === company.ownerId)?.name;
  const subject = asSubject("Company", company);
  const timeline = await getUnifiedTimeline(ctx, { type: "company", id: company.id });
  const cust = await getEntityCustomization(ctx, "company", company.id, company.customFields);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">{company.name}</CardTitle>
            <p className="text-muted-foreground text-xs">{company.industry ?? "Company"}</p>
          </div>
          <CompanyActions
            id={company.id}
            name={company.name}
            canEdit={ctx.ability.can("update", subject)}
            canDelete={ctx.ability.can("delete", subject)}
            canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
            owners={owners}
            defaults={{
              ...cust.formDefaults,
              name: company.name,
              industry: company.industry ?? "",
              website: company.website ?? "",
              email: company.email ?? "",
              phone: company.phone ?? "",
              address: company.address ?? "",
              city: company.city ?? "",
              country: company.country ?? "",
              notes: company.notes ?? "",
              ownerId: company.ownerId ?? undefined,
            }}
          />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Website">{company.website}</DetailField>
            <DetailField label="Email">{company.email}</DetailField>
            <DetailField label="Telepon">{company.phone}</DetailField>
            <DetailField label="Pemilik">{owner}</DetailField>
            <DetailField label="Alamat">
              {[company.address, company.city, company.country].filter(Boolean).join(", ")}
            </DetailField>
          </dl>
        </CardContent>
      </Card>
      <CustomizationCard defs={cust.defs} values={cust.values} tags={cust.tags} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact ({company.contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {company.contacts.length === 0 ? (
              <p className="text-muted-foreground text-label">Belum ada contact di company ini.</p>
            ) : (
              <ul className="space-y-1.5">
                {company.contacts.map((c) => (
                  <li key={c.contact.id} className="text-sm">
                    <Link
                      href={`/contacts/${c.contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.contact.name}
                    </Link>
                    {c.contact.email && (
                      <span className="text-muted-foreground"> · {c.contact.email}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Catatan internal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-label whitespace-pre-wrap">
              {company.notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
            </p>
          </CardContent>
        </Card>
      </div>
      <RelatedDeals deals={await listRelatedDeals(ctx, { companyId: company.id })} />
      <UnifiedTimeline items={timeline} />
      <ActivitiesPanel ctx={ctx} link={{ companyId: company.id }} />
    </div>
  );
}
