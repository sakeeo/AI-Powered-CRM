"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Handshake, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { ToneBadge } from "@/components/shared/tone-badge";
import { CustomizationFilters } from "@/modules/customization/components/customization-filters";
import {
  useCustomColumns,
  type ListCustomization,
} from "@/modules/customization/components/customization-columns";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  DEAL_STATUSES,
  DEAL_STATUS_LABEL,
  DEAL_STATUS_TONE,
  type DealStatus,
} from "@/modules/deals/constants";
import { DealForm, type Opt, type OwnerOpt } from "@/modules/deals/components/deal-form";

export type DealRow = {
  id: string;
  title: string;
  status: string;
  value: string;
  currency: string;
  expectedCloseDate: string | null;
  probability: number | null;
  ownerId: string | null;
  stage: { id: string; name: string; probability: number };
  contact: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
};

export function DealsTable({
  table,
  contacts,
  companies,
  stages,
  owners,
  canAssignOwner,
  defaultCurrency,
  actions,
  custom,
}: {
  table: Omit<DataTableProps<DealRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  contacts: Opt[];
  companies: Opt[];
  stages: Opt[];
  owners: OwnerOpt[];
  canAssignOwner: boolean;
  defaultCurrency: string;
  actions?: React.ReactNode;
  /** Tag & custom field untuk kolom/filter (plan 2.1). */
  custom?: ListCustomization;
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerName = new Map(owners.map((o) => [o.userId, o.name]));
  const canCreate = can("create", "Deal");

  const customColumns = useCustomColumns<DealRow>(custom);
  const columns: ColumnDef<DealRow, unknown>[] = [
    { header: "Deal", accessorKey: "title", meta: { sortKey: "title" } },
    {
      header: "Contact / Company",
      id: "party",
      cell: (c) =>
        [c.row.original.contact?.name, c.row.original.company?.name].filter(Boolean).join(" · ") ||
        "—",
    },
    {
      header: "Stage",
      id: "stage",
      cell: (c) => <ToneBadge tone="blue">{c.row.original.stage.name}</ToneBadge>,
    },
    {
      header: "Status",
      id: "status",
      cell: (c) => (
        <ToneBadge tone={DEAL_STATUS_TONE[c.row.original.status as DealStatus] ?? "blue"}>
          {DEAL_STATUS_LABEL[c.row.original.status as DealStatus] ?? c.row.original.status}
        </ToneBadge>
      ),
    },
    {
      header: "Nilai",
      accessorKey: "value",
      meta: { sortKey: "value", className: "text-right tabular-nums" },
      cell: (c) => formatMoney(c.row.original.value, c.row.original.currency),
    },
    {
      header: "Prob.",
      id: "prob",
      meta: { className: "text-right tabular-nums" },
      cell: (c) => `${c.row.original.probability ?? c.row.original.stage.probability}%`,
    },
    {
      header: "Closing",
      accessorKey: "expectedCloseDate",
      meta: { sortKey: "expectedCloseDate", className: "tabular-nums" },
      cell: (c) =>
        c.row.original.expectedCloseDate
          ? new Date(c.row.original.expectedCloseDate).toLocaleDateString("id-ID")
          : "—",
    },
    {
      header: "PIC",
      id: "owner",
      cell: (c) => (c.row.original.ownerId && ownerName.get(c.row.original.ownerId)) || "—",
    },
  ];

  return (
    <div className="space-y-4">
      <PageActions>
        {actions}
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Tambah deal
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={[...columns, ...customColumns]}
        rowHref={(r) => `/deals/${r.id}`}
        searchPlaceholder="Cari deal, contact, company…"
        toolbar={
          <>
            <CustomizationFilters custom={custom} />
            <UrlFilterSelect
              param="stage"
              label="Filter stage"
              allLabel="Semua stage"
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
            />
            <UrlFilterSelect
              param="status"
              label="Filter status"
              allLabel="Semua status"
              options={DEAL_STATUSES.map((s) => ({ value: s, label: DEAL_STATUS_LABEL[s] }))}
            />
            <UrlFilterSelect
              param="owner"
              label="Filter PIC"
              allLabel="Semua PIC"
              options={owners.map((o) => ({ value: o.userId, label: o.name }))}
            />
          </>
        }
        empty={
          <EmptyState
            icon={Handshake}
            title="Belum ada deal"
            description="Buat deal pertama atau konversi lead yang sudah Qualified."
          >
            {canCreate && <Button onClick={() => setOpen(true)}>Tambah deal</Button>}
          </EmptyState>
        }
      />
      <EntitySheet
        open={open}
        onOpenChange={setOpen}
        title="Deal baru"
        description="Hubungkan dengan contact dan/atau company."
      >
        {open && (
          <DealForm
            contacts={contacts}
            companies={companies}
            stages={stages}
            owners={owners}
            canAssignOwner={canAssignOwner}
            defaultCurrency={defaultCurrency}
            onDone={(id) => {
              setOpen(false);
              if (id) router.push(`/deals/${id}`);
              else router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
