import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { DeleteWorkspaceCard } from "@/modules/organizations/components/delete-workspace-card";
import { DemoWorkspaceCard } from "@/modules/organizations/components/demo-workspace-card";
import { OrganizationProfileForm } from "@/modules/organizations/components/organization-profile-form";
import { getOrganization, orgLogoUrl } from "@/modules/organizations/server/queries";
import { CURRENCIES, DATE_FORMATS } from "@/modules/organizations/schemas";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const ctx = await requireTenant();
  const org = await getOrganization(ctx);
  return (
    <div className="space-y-6">
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
      {/* Khusus Owner: tombol Load Demo Workspace (aksi server juga memeriksa peran Owner). */}
      {ctx.role === "owner" && (
        <>
          <DemoWorkspaceCard />
          <DeleteWorkspaceCard orgName={org.name} />
        </>
      )}
    </div>
  );
}
