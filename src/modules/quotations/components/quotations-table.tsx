"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { FormField } from "@/components/shared/form-field";
import { PageActions } from "@/components/shared/page-actions";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import {
  QUOTATION_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  type QuotationStatus,
} from "@/modules/quotations/calc";
import { createQuotation } from "@/modules/quotations/server/actions";

export type QuotationRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  currency: string;
  validUntil: string;
  deal: { id: string; title: string } | null;
  contact: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
};
type Opt = { id: string; name: string };

export function QuotationsTable({
  table,
  deals,
  contacts,
  companies,
}: {
  table: Omit<DataTableProps<QuotationRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  deals: { id: string; title: string }[];
  contacts: Opt[];
  companies: Opt[];
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dealId, setDealId] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);

  const columns: ColumnDef<QuotationRow, unknown>[] = [
    { header: "Nomor", accessorKey: "number", meta: { sortKey: "number" } },
    { header: "Judul", accessorKey: "title" },
    {
      header: "Customer",
      id: "customer",
      cell: (c) =>
        [c.row.original.contact?.name, c.row.original.company?.name].filter(Boolean).join(" · ") ||
        "—",
    },
    {
      header: "Status",
      id: "status",
      cell: (c) => {
        const s = c.row.original.status as QuotationStatus;
        return <ToneBadge tone={STATUS_TONE[s] ?? "blue"}>{STATUS_LABEL[s] ?? s}</ToneBadge>;
      },
    },
    {
      header: "Total",
      accessorKey: "total",
      meta: { sortKey: "total", className: "text-right tabular-nums" },
      cell: (c) => formatMoney(c.row.original.total, c.row.original.currency),
    },
    {
      header: "Berlaku s.d.",
      accessorKey: "validUntil",
      meta: { sortKey: "validUntil", className: "tabular-nums" },
      cell: (c) =>
        new Date(`${c.row.original.validUntil}T00:00:00Z`).toLocaleDateString("id-ID", {
          timeZone: "UTC",
        }),
    },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createQuotation({ title, dealId, contactId, companyId });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Quotation dibuat");
    router.push(`/quotations/${res.data.id}`);
  }

  return (
    <div className="space-y-4">
      <PageActions>
        {can("create", "Quotation") && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Quotation baru
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={columns}
        rowHref={(r) => `/quotations/${r.id}`}
        searchPlaceholder="Cari nomor, judul, customer…"
        toolbar={
          <UrlFilterSelect
            param="status"
            label="Filter status"
            allLabel="Semua status"
            options={QUOTATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        }
        empty={
          <EmptyState
            icon={FileText}
            title="Belum ada quotation"
            description="Buat quotation dari deal atau dari awal."
          />
        }
      />
      <EntitySheet
        open={open}
        onOpenChange={setOpen}
        title="Quotation baru"
        description="Pilih deal untuk menyalin customer dan produknya."
      >
        {open && (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField id="q-title" label="Judul (opsional)">
              <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField id="q-deal" label="Deal">
              <SelectField
                id="q-deal"
                value={dealId}
                onChange={setDealId}
                noneLabel="Tanpa deal"
                options={deals.map((d) => ({ value: d.id, label: d.title }))}
              />
            </FormField>
            <FormField id="q-contact" label="Contact">
              <SelectField
                id="q-contact"
                value={contactId}
                onChange={setContactId}
                noneLabel="—"
                options={contacts.map((c) => ({ value: c.id, label: c.name }))}
              />
            </FormField>
            <FormField id="q-company" label="Company">
              <SelectField
                id="q-company"
                value={companyId}
                onChange={setCompanyId}
                noneLabel="—"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
            </FormField>
            <Button type="submit" disabled={busy}>
              {busy ? "Membuat…" : "Buat draft"}
            </Button>
          </form>
        )}
      </EntitySheet>
    </div>
  );
}
