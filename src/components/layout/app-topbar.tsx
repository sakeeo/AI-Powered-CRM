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

/** Header template Spike: panel putih rounded-md shadow-card; judul halaman (satu-satunya h1) + subjudul di kiri. */
export function AppTopbar({ bell }: { bell?: React.ReactNode }) {
  const item = currentItem(usePathname());
  return (
    <header className="bg-card shadow-card sticky top-3 z-20 flex shrink-0 items-center gap-3 rounded-md px-4 py-3 sm:px-6 sm:py-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{item?.title ?? "CRM"}</h1>
        {item && (
          <p className="text-muted-foreground hidden truncate text-sm sm:block">
            {item.description}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <CommandPalette />
        {bell}
        <ThemeToggle />
      </div>
    </header>
  );
}
