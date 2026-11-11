import { type ActionContext } from "@/lib/action";
import { scopeWhere } from "@/lib/authz";
import { AppError } from "@/lib/errors";

/** Pastikan record yang ditautkan ada di tenant ini DAN boleh dilihat pengguna (Sales Rep: hanya miliknya). */
export async function assertLinks(
  ctx: ActionContext,
  l: { leadId?: string; contactId?: string; companyId?: string; dealId?: string },
) {
  const checks: [string | undefined, () => Promise<unknown>][] = [
    [
      l.leadId,
      () =>
        ctx.db.lead.findFirst({
          where: { AND: [{ id: l.leadId }, scopeWhere(ctx, "view", "Lead")] } as never,
        }),
    ],
    [
      l.contactId,
      () =>
        ctx.db.contact.findFirst({
          where: {
            AND: [{ id: l.contactId, deletedAt: null }, scopeWhere(ctx, "view", "Contact")],
          } as never,
        }),
    ],
    [
      l.companyId,
      () =>
        ctx.db.company.findFirst({
          where: {
            AND: [{ id: l.companyId, deletedAt: null }, scopeWhere(ctx, "view", "Company")],
          } as never,
        }),
    ],
    [
      l.dealId,
      () =>
        ctx.db.deal.findFirst({
          where: {
            AND: [{ id: l.dealId, deletedAt: null }, scopeWhere(ctx, "view", "Deal")],
          } as never,
        }),
    ],
  ];
  for (const [id, find] of checks)
    if (id && !(await find())) throw new AppError("Record terkait tidak ditemukan");
}
