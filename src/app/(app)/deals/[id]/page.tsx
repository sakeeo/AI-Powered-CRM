import type { Metadata } from "next";
import { CustomizationCard } from "@/modules/customization/components/customization-card";
import { getEntityCustomization } from "@/modules/customization/server/queries";
import { ActivitiesPanel } from "@/modules/activities/components/activities-panel";
import Link from "next/link";
import { DetailField } from "@/components/shared/detail-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asSubject } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { formatMoney } from "@/lib/money";
import { orNotFound } from "@/lib/not-found";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { DEAL_STATUS_LABEL, DEAL_STATUS_TONE, type DealStatus } from "@/modules/deals/constants";
import { LostCategoryEditor } from "@/modules/deals/components/lost-category-editor";
import { DealCloseButtons } from "@/modules/deals/components/deal-close-buttons";
import { DealActions } from "@/modules/deals/components/deal-actions";
import { getDealOrThrow } from "@/modules/deals/server/detail";
import { listQuotationsForDeal } from "@/modules/quotations/server/queries";
import { DealProductsCard } from "@/modules/products/components/deal-products-card";
import { listActiveProducts, listDealProducts } from "@/modules/products/server/queries";
import { DealPredictionCard } from "@/modules/intelligence/components/deal-prediction-card";
import { getDealPrediction } from "@/modules/intelligence/server/deal-prediction";
import { listStageHistory } from "@/modules/deals/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Detail deal" };

export default async function Page(props: PageProps<"/deals/[id]">) {
  const ctx = await requireTenant();
  const { id } = await props.params;
  const [{ deal, pipeline }, contacts, companies, owners, org] = await Promise.all([
    orNotFound(getDealOrThrow(ctx, id)),
    listContactOptions(ctx),
    listCompanyOptions(ctx),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  const subject = asSubject("Deal", deal);
  const cust = await getEntityCustomization(ctx, "deal", deal.id, deal.customFields);
  const status = deal.status as DealStatus;
  const owner = owners.find((o) => o.userId === deal.ownerId)?.name;
  const [prediction, history, dealItems, productOptions, dealQuotations] = await Promise.all([
    getDealPrediction(ctx, deal.id),
    listStageHistory(ctx, deal.id),
    listDealProducts(ctx, deal.id),
    listActiveProducts(ctx),
    listQuotationsForDeal(ctx, deal.id),
  ]);
  const stageName = new Map(pipeline.stages.map((s) => [s.id, s.name]));
  const stages = pipeline.stages.map((s) => ({ id: s.id, name: s.name }));
  return (
    <div className="grid items-stretch gap-6 md:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{deal.title}</CardTitle>
              <ToneBadge tone={DEAL_STATUS_TONE[status] ?? "blue"}>
                {DEAL_STATUS_LABEL[status] ?? status}
              </ToneBadge>
            </div>
            <p className="text-muted-foreground text-xs">
              {pipeline.name} · {deal.stage.name}
            </p>
          </div>
          <DealActions
            id={deal.id}
            title={deal.title}
            stageId={deal.stageId}
            open={deal.status === "open"}
            contacts={contacts}
            companies={companies}
            stages={stages}
            owners={owners}
            defaultCurrency={org.defaultCurrency}
            canEdit={ctx.ability.can("update", subject)}
            canDelete={ctx.ability.can("delete", subject)}
            extra={
              ctx.ability.can("update", subject) ? (
                <DealCloseButtons id={deal.id} status={deal.status} />
              ) : null
            }
            canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
            defaults={{
              ...cust.formDefaults,
              title: deal.title,
              contactId: deal.contactId ?? undefined,
              companyId: deal.companyId ?? undefined,
              value: deal.value,
              currency: deal.currency as "IDR",
              expectedCloseDate: deal.expectedCloseDate ?? undefined,
              probability: deal.probability ?? undefined,
              ownerId: deal.ownerId ?? undefined,
              notes: deal.notes ?? "",
            }}
          />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Nilai">{formatMoney(deal.value, deal.currency)}</DetailField>
            <DetailField label="Probabilitas">{`${deal.probability ?? deal.stage.probability}%${deal.probability == null ? " (stage)" : ""}`}</DetailField>
            <DetailField label="Perkiraan closing">
              {deal.expectedCloseDate &&
                new Date(deal.expectedCloseDate).toLocaleDateString("id-ID")}
            </DetailField>
            <DetailField label="PIC">{owner}</DetailField>
            <DetailField label="Contact">
              {deal.contact && (
                <Link
                  className="text-primary hover:underline"
                  href={`/contacts/${deal.contact.id}`}
                >
                  {deal.contact.name}
                </Link>
              )}
            </DetailField>
            <DetailField label="Company">
              {deal.company && (
                <Link
                  className="text-primary hover:underline"
                  href={`/companies/${deal.company.id}`}
                >
                  {deal.company.name}
                </Link>
              )}
            </DetailField>
            {deal.status === "lost" && (
              <>
                <DetailField label="Alasan kalah">{deal.lostReason}</DetailField>
                <DetailField label="Kategori alasan">
                  <LostCategoryEditor
                    id={deal.id}
                    reason={deal.lostReason ?? ""}
                    category={deal.lostCategory}
                    canEdit={ctx.ability.can("update", subject)}
                  />
                </DetailField>
              </>
            )}
            {deal.closedAt && (
              <DetailField label="Ditutup">
                {new Date(deal.closedAt).toLocaleDateString("id-ID")}
              </DetailField>
            )}
            <DetailField label="Dibuat">
              {new Date(deal.createdAt).toLocaleDateString("id-ID")}
            </DetailField>
          </dl>
        </CardContent>
      </Card>
      {prediction && <DealPredictionCard result={prediction} />}
      <CustomizationCard defs={cust.defs} values={cust.values} tags={cust.tags} />
      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-label whitespace-pre-wrap">
            {deal.notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-col [&>*]:flex-1">
        <DealProductsCard
          dealId={deal.id}
          items={dealItems}
          products={productOptions}
          canEdit={ctx.ability.can("update", subject) && deal.status === "open"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quotation</CardTitle>
        </CardHeader>
        <CardContent>
          {dealQuotations.length === 0 ? (
            <p className="text-muted-foreground text-xs">Belum ada quotation untuk deal ini.</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="deal-quotations">
              {dealQuotations.map((q) => (
                <li key={q.id}>
                  <Link className="text-primary hover:underline" href={`/quotations/${q.id}`}>
                    {q.number}
                  </Link>{" "}
                  — {q.title} · {q.status} · {formatMoney(q.total, q.currency)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat stage</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-xs">Belum ada perpindahan stage.</p>
          ) : (
            <ul className="space-y-1 text-xs" data-testid="stage-history">
              {history.map((h) => (
                <li key={h.id}>
                  {h.fromStageId ? (stageName.get(h.fromStageId) ?? "—") : "—"} →{" "}
                  <strong>{stageName.get(h.toStageId) ?? "—"}</strong> ·{" "}
                  {new Date(h.createdAt).toLocaleString("id-ID")} ·{" "}
                  {owners.find((o) => o.userId === h.changedBy)?.name ?? "—"}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col [&>*]:flex-1">
        <ActivitiesPanel ctx={ctx} link={{ dealId: deal.id }} />
      </div>
    </div>
  );
}
