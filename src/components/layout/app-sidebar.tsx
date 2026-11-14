"use client";

import { Plug } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS } from "@/components/layout/nav";
import { OrgSwitcher, type OrgOption } from "@/components/layout/org-switcher";
import { UserMenu, type SessionUser } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

function isActive(pathname: string, href: string) {
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  user,
  organizations,
  currentOrganizationId,
  disabledHrefs = [],
}: {
  user: SessionUser;
  organizations: OrgOption[];
  currentOrganizationId: string;
  /** Menu yang tidak bisa dibuka (mis. Inbox tanpa kanal terhubung). */
  disabledHrefs?: string[];
}) {
  const pathname = usePathname();
  const [blocked, setBlocked] = useState<string | null>(null);
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="px-4 pt-4 pb-2 group-data-[collapsible=icon]:px-0">
        <OrgSwitcher organizations={organizations} currentId={currentOrganizationId} />
      </SidebarHeader>
      <SidebarContent className="px-4 py-2 group-data-[collapsible=icon]:px-0">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup
            key={group.label}
            className="group-data-[collapsible=icon]:border-sidebar-border p-0 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:not-first:mt-2 group-data-[collapsible=icon]:not-first:border-t"
          >
            <SidebarGroupLabel className="text-sidebar-muted px-3 text-xs font-semibold tracking-wide uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                {group.items.map((item) =>
                  disabledHrefs.includes(item.href) ? (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={`${item.title} — hubungkan kanal terlebih dahulu`}
                        aria-haspopup="dialog"
                        className="opacity-60"
                        onClick={() => setBlocked(item.title)}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive(pathname, item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t px-4 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
      <Dialog open={blocked !== null} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{blocked} belum dapat dibuka</DialogTitle>
            <DialogDescription>
              Belum ada kanal percakapan yang terhubung di organisasi ini.
            </DialogDescription>
          </DialogHeader>
          <div className="text-muted-foreground flex items-start gap-3 text-sm">
            <Plug className="text-loud mt-0.5 size-4 shrink-0" />
            <p>
              Hubungkan minimal satu kanal (WhatsApp, email, atau Google) di Connector Hub. Setelah
              terhubung, menu {blocked} akan terbuka otomatis.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              Nanti saja
            </Button>
            <Button asChild onClick={() => setBlocked(null)}>
              <Link href="/settings/connectors">Hubungkan kanal</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
