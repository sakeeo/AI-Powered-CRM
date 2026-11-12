"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/components/layout/nav";
import { OrgSwitcher, type OrgOption } from "@/components/layout/org-switcher";
import { UserMenu, type SessionUser } from "@/components/layout/user-menu";
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
}: {
  user: SessionUser;
  organizations: OrgOption[];
  currentOrganizationId: string;
}) {
  const pathname = usePathname();
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
                {group.items.map((item) => (
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t px-4 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
