"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { CustomizationFilters } from "@/modules/customization/components/customization-filters";
import {
  useCustomColumns,
  type ListCustomization,
} from "@/modules/customization/components/customization-columns";
import { formatMoney } from "@/lib/money";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  URGENCY_LABEL,
  type LeadStatus,
  type Urgency,
} from "@/modules/leads/constants";
import {
  LeadForm,
  type OwnerOption,
  type SourceOption,
} from "@/modules/leads/components/lead-form";

export type LeadRow = {
  id: string;
  name: string;
  companyName: string | null;
  status: string;
  urgency: string | null;
  budget: string | null;
  currency: string;
  ownerId: string | null;
  createdAt: Date;
  source: { id: string; name: string } | null;
};

export function LeadsTable({
  table,
  sources,
  owners,
  canAssignOwner,
  defaultCurrency,
  archived,
  actions,
  custom,
}: {
  table: Omit<DataTableProps<LeadRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  sources: SourceOption[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  defaultCurrency: string;
  archived: boolean;
  actions?: React.ReactNode;
  /** Tag & custom field untuk kolom/filter (plan 2.1). */
  custom?: ListCustomization;
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerName = new Map(owners.map((o) => [o.userId, o.name]));
  const canCreate = can("create", "Lead");

  const customColumns = useCustomColumns<LeadRow>(custom);
  const columns: ColumnDef<LeadRow, unknown>[] = [
    { header: "Lead", accessorKey: "name", meta: { sortKey: "name" } },
    {
      header: "Perusahaan",
      accessorKey: "companyName",
      cell: (c) => c.row.original.companyName ?? "—",
    },
    {
      header: "Status",
      accessorKey: "status",
      meta: { sortKey: "status" },
      cell: (c) => {
        const s = c.row.original.status as LeadStatus;
        return (
          <ToneBadge tone={LEAD_STATUS_TONE[s] ?? "blue"}>{LEAD_STATUS_LABEL[s] ?? s}</ToneBadge>
        );
      },
    },
    { header: "Sumber", id: "source", cell: (c) => c.row.original.source?.name ?? "—" },
    {
      header: "Urgensi",
      id: "urgency",
      cell: (c) =>
        c.row.original.urgency ? URGENCY_LABEL[c.row.original.urgency as Urgency] : "—",
    },
    {
      header: "Budget",
      accessorKey: "budget",
      meta: { sortKey: "budget", className: "text-right tabular-nums" },
      cell: (c) => formatMoney(c.row.original.budget, c.row.original.currency),
    },
    {
      header: "Owner",
      id: "owner",
      cell: (c) =>
        c.row.original.ownerId ? (
          (ownerName.get(c.row.original.ownerId) ?? "—")
        ) : (
          <span className="text-muted-foreground">Belum ditugaskan</span>
        ),
    },
    {
      header: "Dibuat",
      accessorKey: "createdAt",
      meta: { sortKey: "createdAt", className: "tabular-nums" },
      cell: (c) => new Date(c.row.original.createdAt).toLocaleDateString("id-ID"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageActions>
        <Button
          variant="outline"
          onClick={() => router.push(archived ? "/leads" : "/leads?archived=1")}
        >
          {archived ? "Lihat lead aktif" : "Lihat arsip"}
        </Button>
        {actions}
        {canCreate && !archived && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Tambah lead
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={[...columns, ...customColumns]}
        rowHref={(r) => `/leads/${r.id}`}
        searchPlaceholder="Cari nama, email, perusahaan…"
        toolbar={
          <>
            <CustomizationFilters custom={custom} />
            <UrlFilterSelect
              param="status"
              label="Filter status"
              allLabel="Semua status"
              options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
            />
            <UrlFilterSelect
              param="source"
              label="Filter sumber"
              allLabel="Semua sumber"
              options={sources.map((s) => ({ value: s.id, label: s.name }))}
            />
            <UrlFilterSelect
              param="owner"
              label="Filter owner"
              allLabel="Semua owner"
              options={[
                { value: "unassigned", label: "Belum ditugaskan" },
                ...owners.map((o) => ({ value: o.userId, label: o.name })),
              ]}
            />
          </>
        }
        empty={
          <EmptyState
            icon={Target}
            title={archived ? "Tidak ada lead terarsip" : "Belum ada lead"}
            description={
              archived
                ? "Lead yang diarsipkan muncul di sini."
                : "Catat lead pertama Anda atau impor dari CSV."
            }
          >
            {canCreate && !archived && <Button onClick={() => setOpen(true)}>Tambah lead</Button>}
          </EmptyState>
        }
      />
      <EntitySheet
        open={open}
        onOpenChange={setOpen}
        title="Lead baru"
        description="Quick add — lengkapi nanti di halaman detail."
      >
        {open && (
          <LeadForm
            sources={sources}
            owners={owners}
            canAssignOwner={canAssignOwner}
            defaultCurrency={defaultCurrency}
            onDone={(id) => {
              setOpen(false);
              if (id) router.push(`/leads/${id}`);
              else router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
