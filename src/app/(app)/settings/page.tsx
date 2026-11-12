import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { OrganizationProfileForm } from "@/modules/organizations/components/organization-profile-form";
import { getOrganization, orgLogoUrl } from "@/modules/organizations/server/queries";
import { CURRENCIES, DATE_FORMATS } from "@/modules/organizations/schemas";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const ctx = await requireTenant();
  const org = await getOrganization(ctx);
  return (
    <OrganizationProfileForm
      canEdit={ctx.ability.can("update", "Organization")}
      logoUrl={orgLogoUrl(org)}
      defaults={{
        name: org.name,
        timezone: org.timezone,
        defaultCurrency: (CURRENCIES as readonly string[]).includes(org.defaultCurrency)
          ? (org.defaultCurrency as (typeof CURRENCIES)[number])
          : "IDR",
        dateFormat: (DATE_FORMATS as readonly string[]).includes(org.dateFormat)
          ? (org.dateFormat as (typeof DATE_FORMATS)[number])
          : "dd/MM/yyyy",
      }}
    />
  );
}
