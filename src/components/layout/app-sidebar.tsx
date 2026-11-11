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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3.5 pt-5 pb-4 group-data-[collapsible=icon]:px-2">
        <OrgSwitcher organizations={organizations} currentId={currentOrganizationId} />
      </SidebarHeader>
      <SidebarContent className="px-3.5 py-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="p-0 pt-3">
            <SidebarGroupLabel className="text-sidebar-muted text-micro px-3 font-semibold tracking-wide uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
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
      <SidebarFooter className="border-sidebar-border border-t px-3.5 pt-4 group-data-[collapsible=icon]:px-2">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
