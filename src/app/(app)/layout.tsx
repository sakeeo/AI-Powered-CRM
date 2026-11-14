import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AbilityProvider } from "@/components/providers/ability-provider";
import { requireTenant } from "@/lib/context";
import { AiAssistantWidget } from "@/modules/assistant/components/ai-assistant-widget";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { countUnread, listMyNotifications } from "@/modules/notifications/server/queries";
import { hasConnectedChannel } from "@/modules/whatsapp/server/queries";
import { listMyOrganizations } from "@/modules/organizations/server/queries";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Layout ini sengaja dinamis: seluruh area aplikasi di-guard oleh session + keanggotaan tenant
 * (data per-pengguna, tidak boleh di-cache lintas pengguna). Navigasi dari luar (mis. /login)
 * boleh memblokir di layout; navigasi antar halaman di dalam (app) tidak me-render ulang layout.
 */
export const instant = false;

async function Shell({ children }: { children: React.ReactNode }) {
  // Status sidebar (collapse) disimpan di cookie oleh komponen shadcn.
  // Guard server-side: validasi session ke database; tanpa session → /login.
  const ctx = await requireTenant();
  const [organizations, notifications, unread, inboxEnabled] = await Promise.all([
    listMyOrganizations(ctx.userId),
    listMyNotifications(ctx),
    countUnread(ctx),
    hasConnectedChannel(ctx).catch(() => false),
  ]);
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AbilityProvider rules={ctx.ability.rules}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
      >
        <AppSidebar
          user={{ name: ctx.user.name, email: ctx.user.email }}
          organizations={organizations}
          currentOrganizationId={ctx.organizationId}
          disabledHrefs={inboxEnabled ? [] : ["/inbox"]}
        />
        <SidebarInset className="min-w-0 gap-6 bg-transparent p-3 sm:p-5 md:peer-data-[variant=floating]:pl-0">
          <AppTopbar bell={<NotificationBell unread={unread} items={notifications} />} />
          <div className="flex-1 pb-32">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <AiAssistantWidget />
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
