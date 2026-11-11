import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AbilityProvider } from "@/components/providers/ability-provider";
import { requireTenant } from "@/lib/context";
import { listMyOrganizations } from "@/modules/organizations/server/queries";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

async function Shell({ children }: { children: React.ReactNode }) {
  // Status sidebar (collapse) disimpan di cookie oleh komponen shadcn.
  // Guard server-side: validasi session ke database; tanpa session → /login.
  const ctx = await requireTenant();
  const organizations = await listMyOrganizations(ctx.userId);
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AbilityProvider rules={ctx.ability.rules}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar
          user={{ name: ctx.user.name, email: ctx.user.email }}
          organizations={organizations}
          currentOrganizationId={ctx.organizationId}
        />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <div className="flex-1 p-3 sm:p-4 lg:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AbilityProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
