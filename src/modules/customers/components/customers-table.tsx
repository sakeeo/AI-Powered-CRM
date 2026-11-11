"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/tone-badge";
import { formatMoney } from "@/lib/money";

export type CustomerTableRow = {
  key: string;
  type: "company" | "contact";
  id: string;
  name: string;
  wonCount: number;
  totals: Record<string, string>;
  lastWonAt: Date | null;
  segments: { id: string; name: string }[];
};

export function CustomersTable({
  table,
  segments,
}: {
  table: Omit<DataTableProps<CustomerTableRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  segments: { id: string; name: string }[];
}) {
  const columns: ColumnDef<CustomerTableRow, unknown>[] = [
    { header: "Customer", accessorKey: "name", meta: { sortKey: "name" } },
    {
      header: "Tipe",
      id: "type",
      cell: (c) => (
        <ToneBadge tone="blue">
          {c.row.original.type === "company" ? "Company" : "Contact"}
        </ToneBadge>
      ),
    },
    {
      header: "Deal Won",
      accessorKey: "wonCount",
      meta: { sortKey: "wonCount", className: "text-right tabular-nums" },
    },
    {
      header: "Total belanja",
      id: "total",
      meta: { className: "text-right tabular-nums" },
      cell: (c) =>
        Object.entries(c.row.original.totals)
          .map(([cur, v]) => formatMoney(v, cur))
          .join(" + "),
    },
    {
      header: "Pembelian terakhir",
      accessorKey: "lastWonAt",
      meta: { sortKey: "lastWonAt", className: "tabular-nums" },
      cell: (c) =>
        c.row.original.lastWonAt
          ? new Date(c.row.original.lastWonAt).toLocaleDateString("id-ID")
          : "—",
    },
    {
      header: "Segmen",
      id: "segments",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.row.original.segments.map((s) => (
            <ToneBadge key={s.id} tone="orange">
              {s.name}
            </ToneBadge>
          ))}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      {...table}
      columns={columns}
      rowHref={(r) => `/customers/${r.type}/${r.id}`}
      searchPlaceholder="Cari customer…"
      toolbar={
        <>
          <UrlFilterSelect
            param="type"
            label="Filter tipe"
            allLabel="Semua tipe"
            options={[
              { value: "company", label: "Company" },
              { value: "contact", label: "Contact" },
            ]}
          />
          <UrlFilterSelect
            param="segment"
            label="Filter segmen"
            allLabel="Semua segmen"
            options={segments.map((s) => ({ value: s.id, label: s.name }))}
          />
        </>
      }
      empty={
        <EmptyState
          icon={Users}
          title="Belum ada customer"
          description="Customer muncul otomatis ketika sebuah deal ditandai Won."
        />
      }
    />
  );
}
