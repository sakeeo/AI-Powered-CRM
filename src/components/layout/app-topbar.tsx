"use client";

import { usePathname } from "next/navigation";
import { ALL_NAV_ITEMS } from "@/components/layout/nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** Terpanjang yang cocok menang, agar /settings/connectors tidak jatuh ke /settings. */
function currentItem(pathname: string) {
  return ALL_NAV_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

/** Topbar mockup: 64px, sticky, blur; judul halaman (satu-satunya h1) + subjudul di kiri. */
export function AppTopbar() {
  const item = currentItem(usePathname());
  return (
    <header className="bg-card/85 border-border sticky top-0 z-20 flex h-[58px] shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md sm:h-16 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <div className="min-w-0">
        <h1 className="text-page-title truncate font-bold">{item?.title ?? "CRM"}</h1>
        {item && (
          <p className="text-muted-foreground hidden truncate text-xs sm:block">
            {item.description}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <CommandPalette />
        <ThemeToggle />
      </div>
    </header>
  );
}
