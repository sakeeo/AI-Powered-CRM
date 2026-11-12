import type { Metadata } from "next";
import { asSubject } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { orNotFound } from "@/lib/not-found";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { listActiveProducts } from "@/modules/products/server/queries";
import { QuotationBuilder } from "@/modules/quotations/components/quotation-builder";
import { getQuotation } from "@/modules/quotations/server/queries";
import {
  APPROVER_ROLES,
  canDecide,
  requiresApproval,
  type ApprovalStatus,
} from "@/modules/quotations/approval";
import { ApprovalCard, HistoryCard } from "@/modules/quotations/components/quotation-extras";
import { getQuotationSettings } from "@/modules/quotations/server/settings";
import { listVersions } from "@/modules/quotations/server/versions";

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
  const [versions, settings] = await Promise.all([
    listVersions(ctx.db, id),
    getQuotationSettings(ctx.db),
  ]);
  const canEdit = ctx.ability.can("update", subject);
  return (
    <div className="space-y-4">
      <QuotationBuilder
        q={q}
        products={products}
        contacts={contacts}
        companies={companies}
        canEdit={canEdit}
        canDelete={ctx.ability.can("delete", subject)}
      />
      <ApprovalCard
        id={q.id}
        status={q.approvalStatus as ApprovalStatus}
        required={requiresApproval(q.total, settings.approvalThreshold)}
        threshold={settings.approvalThreshold}
        currency={q.currency}
        note={q.approvalNote}
        isDraft={q.status === "draft"}
        canRequest={canEdit}
        canDecide={canDecide({
          role: ctx.role,
          userId: ctx.userId,
          requestedBy: q.approvalRequestedBy,
        })}
        canCancel={
          q.approvalRequestedBy === ctx.userId ||
          (APPROVER_ROLES as readonly string[]).includes(ctx.role)
        }
      />
      <HistoryCard
        id={q.id}
        versions={versions}
        currency={q.currency}
        canRestore={canEdit && q.status === "draft" && q.approvalStatus !== "pending"}
      />
    </div>
  );
}
