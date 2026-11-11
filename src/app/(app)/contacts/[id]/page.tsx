import type { Metadata } from "next";
import { ActivitiesPanel } from "@/modules/activities/components/activities-panel";
import Link from "next/link";
import { DetailField } from "@/components/shared/detail-field";
import { RelatedDeals } from "@/modules/deals/components/related-deals";
import { listRelatedDeals } from "@/modules/deals/server/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { orNotFound } from "@/lib/not-found";
import { asSubject } from "@/lib/abilities";
import { DuplicatesCard } from "@/modules/duplicates/components/duplicates-card";
import { findContactDuplicates } from "@/modules/duplicates/server/detect";
import { ContactActions } from "@/modules/contacts/components/contact-actions";
import { getContact, listCompanyOptions } from "@/modules/contacts/server/queries";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Detail contact" };

export default async function Page(props: PageProps<"/contacts/[id]">) {
  const ctx = await requireTenant();
  const { id } = await props.params;
  const [contact, companies, owners] = await Promise.all([
    orNotFound(getContact(ctx, id)),
    listCompanyOptions(ctx),
    listOwnerOptions(ctx),
  ]);
  const owner = owners.find((o) => o.userId === contact.ownerId)?.name;
  const subject = asSubject("Contact", contact);
  const dups = await findContactDuplicates(ctx, {
    name: contact.name,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    companyIds: contact.companies.map((c) => c.company.id),
    excludeId: contact.id,
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">{contact.name}</CardTitle>
            <p className="text-muted-foreground text-xs">{contact.jobTitle ?? "Contact"}</p>
          </div>
          <ContactActions
            id={contact.id}
            name={contact.name}
            canEdit={ctx.ability.can("update", subject)}
            canDelete={ctx.ability.can("delete", subject)}
            canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
            companies={companies}
            owners={owners}
            defaults={{
              name: contact.name,
              email: contact.email ?? "",
              phone: contact.phone ?? "",
              jobTitle: contact.jobTitle ?? "",
              address: contact.address ?? "",
              city: contact.city ?? "",
              country: contact.country ?? "",
              notes: contact.notes ?? "",
              ownerId: contact.ownerId ?? undefined,
              companyIds: contact.companies.map((c) => c.company.id),
            }}
          />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Email">
              {contact.email && (
                <a className="text-primary hover:underline" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              )}
            </DetailField>
            <DetailField label="Telepon">
              {contact.phone && (
                <a className="text-primary hover:underline" href={`tel:${contact.phone}`}>
                  {contact.phone}
                </a>
              )}
            </DetailField>
            <DetailField label="Alamat">
              {[contact.address, contact.city, contact.country].filter(Boolean).join(", ")}
            </DetailField>
            <DetailField label="Pemilik">{owner}</DetailField>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent>
            {contact.companies.length === 0 ? (
              <p className="text-muted-foreground text-label">Belum terhubung ke company.</p>
            ) : (
              <ul className="space-y-1.5">
                {contact.companies.map((c) => (
                  <li key={c.company.id} className="flex items-center gap-2 text-sm">
                    <Link
                      href={`/companies/${c.company.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.company.name}
                    </Link>
                    {c.isPrimary && <span className="text-muted-foreground text-xs">(utama)</span>}
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
              {contact.notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
            </p>
          </CardContent>
        </Card>
      </div>
      <RelatedDeals deals={await listRelatedDeals(ctx, { contactId: contact.id })} />
      <DuplicatesCard
        entity="contact"
        currentId={contact.id}
        currentName={contact.name}
        matches={dups}
        canMerge={ctx.ability.can("update", subject) && ctx.ability.can("delete", subject)}
      />
      <ActivitiesPanel ctx={ctx} link={{ contactId: contact.id }} />
    </div>
  );
}
