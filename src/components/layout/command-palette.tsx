"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_GROUPS } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Kerangka Global Search (Ctrl/Cmd+K). Pencarian lintas entitas ditambahkan di Phase 1. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="bg-muted hover:bg-muted/70 text-muted-foreground border-border w-9 justify-center gap-2 px-0 text-[13px] font-normal sm:w-[220px] sm:justify-start sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Buka pencarian"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Cari…</span>
        <kbd className="bg-card text-micro ml-auto hidden rounded px-1.5 font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Ketik untuk mencari halaman…" />
          <CommandList>
            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
            {NAV_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.title}
                    onSelect={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
