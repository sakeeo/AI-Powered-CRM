"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/components/layout/nav";
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

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b px-3.5 pt-5 pb-5 group-data-[collapsible=icon]:px-2">
        <div className="px-2.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-center">
          <strong className="block truncate text-[17px] leading-tight font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            CRM
          </strong>
          <span className="text-sidebar-muted block truncate text-xs group-data-[collapsible=icon]:hidden">
            Sales Workspace
          </span>
          <strong className="hidden text-lg font-bold group-data-[collapsible=icon]:block">
            C
          </strong>
        </div>
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
        <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center">
          <div
            aria-hidden
            className="text-primary grid size-[34px] shrink-0 place-items-center rounded-full bg-white/90 font-extrabold"
          >
            A
          </div>
          <div className="min-w-0 text-[13px] leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block truncate">Admin User</span>
            <small className="text-sidebar-muted text-micro block truncate">
              admin@example.com
            </small>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
