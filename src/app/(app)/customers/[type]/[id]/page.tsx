import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { formatMoney } from "@/lib/money";
import { orNotFound } from "@/lib/not-found";
import { ActivitiesPanel } from "@/modules/activities/components/activities-panel";
import {
  BriefingCard,
  FollowUpScheduler,
  SegmentsEditor,
} from "@/modules/customers/components/customer-tools";
import { FeedbackSection } from "@/modules/customers/components/feedback-section";
import { PARTY_TYPES, type PartyType } from "@/modules/customers/schemas";
import { getCustomer360, listSegments } from "@/modules/customers/server/queries";
import { DEAL_STATUS_LABEL, DEAL_STATUS_TONE, type DealStatus } from "@/modules/deals/constants";
import { STATUS_LABEL, STATUS_TONE, type QuotationStatus } from "@/modules/quotations/calc";

export const metadata: Metadata = { title: "Customer 360" };

export default async function Page(props: PageProps<"/customers/[type]/[id]">) {
  const ctx = await requireTenant();
  const { type, id } = await props.params;
  if (!(PARTY_TYPES as readonly string[]).includes(type)) notFound();
  const t = type as PartyType;
  const [c, allSegments] = await Promise.all([
    orNotFound(getCustomer360(ctx, t, id)),
    listSegments(ctx),
  ]);
  const party = { type: t, id };
  const canEdit = ctx.ability.can("update", t === "company" ? "Company" : "Contact");
  const link = t === "company" ? { companyId: id } : { contactId: id };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{c.name}</CardTitle>
              <ToneBadge tone="green">Customer</ToneBadge>
            </div>
            <p className="text-muted-foreground text-xs">
              {t === "company" ? "Company" : "Contact"} ·{" "}
              <Link
                className="text-primary hover:underline"
                href={`/${t === "company" ? "companies" : "contacts"}/${id}`}
              >
                Lihat record
              </Link>
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">Total belanja</dt>
              <dd className="text-kpi-sm font-bold tabular-nums" data-testid="total-spend">
                {Object.entries(c.totals)
                  .map(([cur, v]) => formatMoney(v, cur))
                  .join(" + ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Deal Won</dt>
              <dd className="text-kpi-sm font-bold tabular-nums">{c.wonCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Pembelian terakhir</dt>
              <dd className="text-kpi-sm font-bold tabular-nums">
                {c.lastWonAt ? c.lastWonAt.toLocaleDateString("id-ID") : "—"}
              </dd>
            </div>
          </dl>
          <SegmentsEditor party={party} segments={c.segments} all={allSegments} canEdit={canEdit} />
          <FollowUpScheduler party={party} name={c.name} />
          <BriefingCard party={party} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat deal & pembelian</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y text-sm" data-testid="customer-deals">
            {c.deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link className="text-primary hover:underline" href={`/deals/${d.id}`}>
                  {d.title}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{d.stage}</span>
                  <ToneBadge tone={DEAL_STATUS_TONE[d.status as DealStatus] ?? "blue"}>
                    {DEAL_STATUS_LABEL[d.status as DealStatus] ?? d.status}
                  </ToneBadge>
                  <span className="tabular-nums">{formatMoney(d.value, d.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotation</CardTitle>
        </CardHeader>
        <CardContent>
          {c.quotations.length === 0 ? (
            <p className="text-muted-foreground text-xs">Belum ada quotation.</p>
          ) : (
            <ul className="divide-border divide-y text-sm" data-testid="customer-quotations">
              {c.quotations.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link className="text-primary hover:underline" href={`/quotations/${q.id}`}>
                    {q.number} — {q.title}
                  </Link>
                  <span className="flex items-center gap-2">
                    <ToneBadge tone={STATUS_TONE[q.status as QuotationStatus] ?? "blue"}>
                      {STATUS_LABEL[q.status as QuotationStatus] ?? q.status}
                    </ToneBadge>
                    <span className="tabular-nums">{formatMoney(q.total, q.currency)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback & complaint</CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackSection items={c.feedback} fixed={link} />
        </CardContent>
      </Card>

      <ActivitiesPanel ctx={ctx} link={link} phone={c.partyPhone} />
    </div>
  );
}
