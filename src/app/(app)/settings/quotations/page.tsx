import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { QuotationSettingsForm } from "@/modules/quotations/components/quotation-settings-form";
import { getQuotationSettings } from "@/modules/quotations/server/settings";

export const metadata: Metadata = { title: "Pengaturan Quotation" };

export default async function Page() {
  const ctx = await requireTenant();
  const settings = await getQuotationSettings(ctx.db);
  return (
    <QuotationSettingsForm initial={settings} canEdit={ctx.ability.can("update", "Organization")} />
  );
}
