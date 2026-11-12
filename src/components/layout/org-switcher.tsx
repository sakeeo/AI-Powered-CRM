"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { isRole, ROLE_LABEL } from "@/lib/roles";

export type OrgOption = { id: string; name: string; role: string; logoUrl?: string | null };

/** Brand sidebar sekaligus switcher organisasi (satu pengguna bisa di banyak organisasi). */
export function OrgSwitcher({
  organizations,
  currentId,
}: {
  organizations: OrgOption[];
  currentId: string;
}) {
  const router = useRouter();
  const current = organizations.find((o) => o.id === currentId);

  async function switchTo(id: string) {
    if (id === currentId) return;
    await authClient.organization.setActive({ organizationId: id });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ganti organisasi"
          className="hover:bg-sidebar-accent/40 focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left outline-none group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 focus-visible:ring-2"
        >
          {current?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.logoUrl}
              alt=""
              className="size-9 shrink-0 rounded-md bg-white object-contain group-data-[collapsible=icon]:hidden"
            />
          )}
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <strong className="block truncate text-[17px] leading-tight font-bold tracking-tight">
              {current?.name ?? "CRM"}
            </strong>
            <span className="text-sidebar-muted block truncate text-xs">
              {current && isRole(current.role) ? ROLE_LABEL[current.role] : "Sales Workspace"}
            </span>
          </span>
          <strong className="hidden text-lg font-bold group-data-[collapsible=icon]:block">
            {current?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.logoUrl}
                alt=""
                className="size-8 rounded-full bg-white object-contain"
              />
            ) : (
              (current?.name ?? "C").charAt(0).toUpperCase()
            )}
          </strong>
          <ChevronsUpDown className="size-4 shrink-0 opacity-70 group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Organisasi
        </DropdownMenuLabel>
        {organizations.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => switchTo(o.id)}>
            <span className="flex-1 truncate">{o.name}</span>
            {o.id === currentId && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/onboarding?new=1")}>
          <Plus className="size-4" /> Buat organisasi baru
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
