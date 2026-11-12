"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export type SessionUser = { name: string; email: string };

/** Pengguna aktif di footer sidebar + menu keluar (design-system §4, footer sidebar). */
export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu pengguna"
          className="hover:bg-sidebar-accent/40 focus-visible:ring-sidebar-ring flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left outline-none group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center focus-visible:ring-2"
        >
          <span
            aria-hidden
            className="text-primary grid size-[34px] shrink-0 place-items-center rounded-full bg-white/90 font-extrabold uppercase"
          >
            {user.name.charAt(0) || "?"}
          </span>
          <span className="min-w-0 flex-1 text-[13px] leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block truncate">{user.name}</span>
            <small className="text-sidebar-muted block truncate text-xs">{user.email}</small>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-70 group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
