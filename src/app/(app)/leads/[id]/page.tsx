import type { Metadata } from "next";
import { DetailField } from "@/components/shared/detail-field";
import { PlaceholderCard } from "@/components/shared/placeholder-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asSubject } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { formatMoney } from "@/lib/money";
import { orNotFound } from "@/lib/not-found";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  URGENCY_LABEL,
  type LeadStatus,
  type Urgency,
} from "@/modules/leads/constants";
import { DuplicatesCard } from "@/modules/duplicates/components/duplicates-card";
import { findLeadDuplicates } from "@/modules/duplicates/server/detect";
import { ConvertLeadDialog } from "@/modules/leads/components/convert-lead-dialog";
import { getConversionSuggestions } from "@/modules/leads/server/conversion";
import { LeadActions } from "@/modules/leads/components/lead-actions";
import { getLead, listLeadSources } from "@/modules/leads/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Detail lead" };

export default async function Page(props: PageProps<"/leads/[id]">) {
  const ctx = await requireTenant();
  const { id } = await props.params;
  const [lead, sources, owners, org] = await Promise.all([
    orNotFound(getLead(ctx, id)),
    listLeadSources(ctx, { activeOnly: true }),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  const subject = asSubject("Lead", lead);
  const canConvert =
    lead.status === "qualified" &&
    !lead.archivedAt &&
    !lead.convertedAt &&
    ctx.ability.can("update", subject);
  const [suggestions, dups] = await Promise.all([
    canConvert ? getConversionSuggestions(ctx, lead.id) : null,
    lead.convertedAt || lead.archivedAt
      ? []
      : findLeadDuplicates(ctx, {
          name: lead.name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          companyName: lead.companyName ?? undefined,
          excludeId: lead.id,
        }),
  ]);
  const status = lead.status as LeadStatus;
  const owner = owners.find((o) => o.userId === lead.ownerId)?.name;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{lead.name}</CardTitle>
              <ToneBadge tone={LEAD_STATUS_TONE[status] ?? "blue"}>
                {LEAD_STATUS_LABEL[status] ?? status}
              </ToneBadge>
              {lead.archivedAt && <ToneBadge tone="orange">Arsip</ToneBadge>}
              {lead.convertedAt && <ToneBadge tone="green">Terkonversi</ToneBadge>}
            </div>
            <p className="text-muted-foreground text-xs">{lead.companyName ?? "Lead"}</p>
          </div>
          <LeadActions
            id={lead.id}
            name={lead.name}
            status={lead.status}
            ownerId={lead.ownerId}
            archived={!!lead.archivedAt}
            converted={!!lead.convertedAt}
            sources={sources.map((s) => ({ id: s.id, name: s.name }))}
            owners={owners}
            defaultCurrency={org.defaultCurrency}
            canEdit={ctx.ability.can("update", subject)}
            canArchive={ctx.ability.can("delete", subject)}
            canAssign={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
            extra={
              suggestions && (
                <ConvertLeadDialog
                  leadId={lead.id}
                  leadName={lead.name}
                  hasCompanyName={!!lead.companyName}
                  companyName={lead.companyName}
                  suggestions={suggestions}
                  defaults={{
                    title: `${lead.name} — ${lead.needs?.slice(0, 40) || "Peluang baru"}`,
                    value: lead.budget ?? "",
                  }}
                />
              )
            }
            defaults={{
              name: lead.name,
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              companyName: lead.companyName ?? "",
              needs: lead.needs ?? "",
              budget: lead.budget ?? "",
              currency: lead.currency as "IDR",
              urgency: (lead.urgency ?? undefined) as Urgency | undefined,
              notes: lead.notes ?? "",
              sourceId: lead.source?.id,
              ownerId: lead.ownerId ?? undefined,
            }}
          />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Email">
              {lead.email && (
                <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>
                  {lead.email}
                </a>
              )}
            </DetailField>
            <DetailField label="Telepon">
              {lead.phone && (
                <a className="text-primary hover:underline" href={`tel:${lead.phone}`}>
                  {lead.phone}
                </a>
              )}
            </DetailField>
            <DetailField label="Sumber">{lead.source?.name}</DetailField>
            <DetailField label="Owner">{owner ?? "Belum ditugaskan"}</DetailField>
            <DetailField label="Budget">
              {lead.budget && formatMoney(lead.budget, lead.currency)}
            </DetailField>
            <DetailField label="Urgensi">
              {lead.urgency && URGENCY_LABEL[lead.urgency as Urgency]}
            </DetailField>
            <DetailField label="Dibuat">
              {new Date(lead.createdAt).toLocaleDateString("id-ID")}
            </DetailField>
            {lead.unqualifiedReason && (
              <DetailField label="Alasan Unqualified">{lead.unqualifiedReason}</DetailField>
            )}
          </dl>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kebutuhan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-label whitespace-pre-wrap">
              {lead.needs || <span className="text-muted-foreground">Belum dicatat.</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-label whitespace-pre-wrap">
              {lead.notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
            </p>
          </CardContent>
        </Card>
      </div>
      {lead.convertedAt && (
        <Card>
          <CardHeader>
            <CardTitle>Hasil konversi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            {lead.convertedContactId && (
              <a
                className="text-primary hover:underline"
                href={`/contacts/${lead.convertedContactId}`}
              >
                Contact
              </a>
            )}
            {lead.convertedCompanyId && (
              <a
                className="text-primary hover:underline"
                href={`/companies/${lead.convertedCompanyId}`}
              >
                Company
              </a>
            )}
            {lead.convertedDealId && (
              <a className="text-primary hover:underline" href={`/deals/${lead.convertedDealId}`}>
                Deal
              </a>
            )}
            <span className="text-muted-foreground">
              pada {new Date(lead.convertedAt).toLocaleDateString("id-ID")}
            </span>
          </CardContent>
        </Card>
      )}
      <DuplicatesCard
        entity="lead"
        currentId={lead.id}
        currentName={lead.name}
        matches={dups}
        canMerge={ctx.ability.can("update", subject) && ctx.ability.can("delete", subject)}
      />
      <PlaceholderCard title="Aktivitas" description="Timeline aktivitas lead." />
    </div>
  );
}
