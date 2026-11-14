"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Building2, Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import { ToneBadge } from "@/components/shared/tone-badge";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { searchCompanyOptions } from "@/modules/companies/server/actions";

type Option = { id: string; name: string };

/**
 * Pilih satu atau lebih company dengan pencarian otomatis ke database (cmdk + Popover).
 * Nilai = daftar id company; yang pertama dipilih menjadi company utama.
 */
export function CompanyMultiCombobox({
  id,
  value,
  onChange,
  known = [],
}: {
  id: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Company yang sudah diketahui namanya (untuk menampilkan chip pilihan awal). */
  known?: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ q: string; options: Option[] } | null>(null);
  // Cache nama company agar chip tetap tampil walau hasil pencarian berganti.
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(known.map((c) => [c.id, c.name])),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const q = query.trim();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchCompanyOptions({ q });
      if (cancelled) return;
      const options = res.ok ? res.data : [];
      setResult({ q, options });
      setNames((n) => ({ ...n, ...Object.fromEntries(options.map((o) => [o.id, o.name])) }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const loading = open && result?.q !== q;
  const options = result?.options ?? [];

  function toggle(optionId: string) {
    onChange(value.includes(optionId) ? value.filter((x) => x !== optionId) : [...value, optionId]);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((cid, i) => (
            <li
              key={cid}
              className="bg-secondary text-secondary-foreground inline-flex h-7 items-center gap-1.5 rounded-3xl pr-1 pl-3 text-xs font-medium"
            >
              <span className="max-w-48 truncate">{names[cid] ?? "Company"}</span>
              {i === 0 && value.length > 1 && (
                <ToneBadge tone="green" className="h-4 px-1.5 text-[10px]">
                  Utama
                </ToneBadge>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== cid))}
                className="hover:bg-foreground/10 rounded-full p-0.5"
                aria-label={`Hapus ${names[cid] ?? "company"}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <CommandPrimitive shouldFilter={false} loop className="w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <CommandPrimitive.Input
              ref={inputRef}
              id={id}
              value={query}
              onValueChange={(v) => {
                setQuery(v);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && open) {
                  e.stopPropagation();
                  setOpen(false);
                }
                if (e.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
              }}
              aria-controls={listId}
              autoComplete="off"
              placeholder="Cari company untuk ditambahkan…"
              className={cn(
                "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 bg-card h-11 w-full min-w-0 rounded-sm border px-4 py-1 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm",
              )}
            />
          </PopoverAnchor>
          <PopoverContent
            className="w-(--radix-popover-trigger-width) p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (e.target instanceof Node && inputRef.current?.contains(e.target))
                e.preventDefault();
            }}
          >
            <CommandList id={listId}>
              {options.length > 0 && (
                <CommandGroup heading="Company terdaftar">
                  {options.map((o) => {
                    const selected = value.includes(o.id);
                    return (
                      <CommandItem
                        key={o.id}
                        value={`company:${o.id}`}
                        onSelect={() => toggle(o.id)}
                      >
                        <Building2 className="text-muted-foreground" />
                        <span className="truncate">{o.name}</span>
                        {selected && <Check className="text-primary ml-auto size-4" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {!loading && options.length === 0 && (
                <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                  {q ? `Company “${q}” tidak ditemukan.` : "Belum ada company."}
                </p>
              )}
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
    </div>
  );
}
