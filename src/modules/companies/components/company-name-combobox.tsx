"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Building2, Loader2, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import { ToneBadge } from "@/components/shared/tone-badge";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { searchCompanyOptions } from "@/modules/companies/server/actions";

type Option = { id: string; name: string };

const INPUT_CLASS =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 bg-card h-11 w-full min-w-0 rounded-sm border px-4 py-1 text-base transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3 md:text-sm";

/**
 * Input nama perusahaan dengan pencarian otomatis ke database company (cmdk + Popover).
 * Nilai tetap teks bebas: pilih company yang ada, atau ketik nama baru (ditandai "Baru").
 */
export function CompanyNameCombobox({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Hasil pencarian terakhir beserta query-nya; "loading" = hasil belum untuk teks saat ini.
  const [result, setResult] = useState<{ q: string; options: Option[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const q = value.trim();

  // Cari dengan debounce setiap kali teks berubah (juga saat awal, untuk status Terdaftar/Baru).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchCompanyOptions({ q });
      if (!cancelled) setResult({ q, options: res.ok ? res.data : [] });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const loading = result?.q !== q;
  const options = result?.options ?? [];

  const exact = options.find((o) => o.name.toLowerCase() === q.toLowerCase());
  const isNew = q.length > 0 && !exact && !loading;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <CommandPrimitive shouldFilter={false} loop className="w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <CommandPrimitive.Input
                ref={inputRef}
                id={id}
                value={value}
                onValueChange={(v) => {
                  onChange(v);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={onBlur}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && open) {
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                aria-invalid={invalid}
                aria-controls={listId}
                autoComplete="off"
                placeholder="Ketik untuk mencari perusahaan…"
                className={cn(INPUT_CLASS, "pr-10")}
              />
              {loading && open && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
              )}
            </div>
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
                <CommandGroup heading="Perusahaan terdaftar">
                  {options.map((o) => (
                    <CommandItem key={o.id} value={`company:${o.id}`} onSelect={() => pick(o.name)}>
                      <Building2 className="text-muted-foreground" />
                      <span className="truncate">{o.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {isNew && (
                <CommandGroup>
                  <CommandItem value="__new__" onSelect={() => pick(q)}>
                    <Plus className="text-muted-foreground" />
                    <span className="truncate">
                      Gunakan “<span className="font-medium">{q}</span>” sebagai perusahaan baru
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
              {!loading && options.length === 0 && !q && (
                <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                  Belum ada perusahaan. Ketik nama untuk menambah baru.
                </p>
              )}
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
      {q && !open && !loading && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          {exact ? (
            <>
              <ToneBadge tone="green" className="h-5 px-2">
                Terdaftar
              </ToneBadge>
              Terhubung ke data perusahaan.
            </>
          ) : (
            <>
              <ToneBadge tone="orange" className="h-5 px-2">
                Baru
              </ToneBadge>
              Belum ada di database — otomatis ditambahkan ke Companies saat lead disimpan.
            </>
          )}
        </p>
      )}
    </div>
  );
}
