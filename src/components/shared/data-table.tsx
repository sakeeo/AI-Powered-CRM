"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { cn } from "cn";
import { PAGE_SIZE_OPTIONS } from "@/lib/list-params";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Nama kolom sort di server (whitelist di parseListParams). Tanpa ini kolom tidak bisa diurutkan. */
    sortKey?: string;
    className?: string;
  }
}

/** Hook: ubah query string URL (sumber kebenaran state tabel; server yang memfilter/mengurutkan). */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  function set(updates: Record<string, string | undefined>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in updates)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { sp, set, pending };
}

/** Filter dropdown yang menulis ke query string. */
export function UrlFilterSelect({
  param,
  label,
  options,
  allLabel = "Semua",
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const { sp, set } = useUrlState();
  const value = sp.get(param) ?? "all";
  return (
    <Select value={value} onValueChange={(v) => set({ [param]: v === "all" ? undefined : v })}>
      <SelectTrigger size="sm" className={cn("w-40", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pilihan jumlah item per halaman (menulis `pageSize` ke URL, kembali ke halaman 1). */
export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const { set } = useUrlState();
  const options = PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? [...PAGE_SIZE_OPTIONS]
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Per halaman</span>
      <Select value={String(pageSize)} onValueChange={(v) => set({ pageSize: v })}>
        <SelectTrigger size="sm" className="w-20" aria-label="Jumlah item per halaman">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  searchPlaceholder?: string;
  rowHref?: (row: T) => string;
  toolbar?: ReactNode;
  empty?: ReactNode;
};

/**
 * Tabel data standar: sorting, pencarian, filter, dan pagination dikendalikan SERVER lewat URL.
 * Dipakai semua modul (contact, company, lead, deal, produk, ...). Kolom boleh `meta.sortKey`.
 */
export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  dir = "desc",
  q = "",
  searchPlaceholder = "Cari…",
  rowHref,
  toolbar,
  empty,
}: DataTableProps<T>) {
  const { set, pending } = useUrlState();
  const [search, setSearch] = useState(q);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => set({ q: search || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pages,
  });

  return (
    <Card className={cn("overflow-hidden", pending && "opacity-70 transition-opacity")}>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Cari data"
            className="bg-muted h-8 pl-8 text-[13px]"
          />
        </div>
        {toolbar}
        <div className="text-xs sm:ml-auto">
          <PageSizeSelect pageSize={pageSize} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sortKey = h.column.columnDef.meta?.sortKey;
                  const active = sortKey && sort === sortKey;
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        "text-muted-foreground text-xs font-semibold",
                        h.column.columnDef.meta?.className,
                      )}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {h.isPlaceholder ? null : sortKey ? (
                        <button
                          type="button"
                          className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2"
                          onClick={() =>
                            set(
                              { sort: sortKey, dir: active && dir === "asc" ? "desc" : "asc" },
                              false,
                            )
                          }
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active ? (
                            dir === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  {empty ?? (
                    <p className="text-muted-foreground py-12 text-center text-sm">
                      Tidak ada data yang cocok.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-accent/50 h-11">
                  {row.getVisibleCells().map((cell, i) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {i === 0 && rowHref ? (
                        <Link href={rowHref(row.original)} className="font-medium hover:underline">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Link>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {total === 0
            ? "0 data"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} dari ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => set({ page: String(page - 1) }, false)}
          >
            Sebelumnya
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => set({ page: String(page + 1) }, false)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </Card>
  );
}
