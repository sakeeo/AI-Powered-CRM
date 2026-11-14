"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { CustomizationFilters } from "@/modules/customization/components/customization-filters";
import {
  useCustomColumns,
  type ListCustomization,
} from "@/modules/customization/components/customization-columns";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/modules/companies/components/company-form";
import type { OwnerOption } from "@/modules/contacts/components/contact-form";

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  ownerId: string | null;
  createdAt: Date;
  _count: { contacts: number };
};

export function CompaniesTable({
  table,
  owners,
  canAssignOwner,
  actions,
  custom,
}: {
  table: Omit<DataTableProps<CompanyRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  owners: OwnerOption[];
  canAssignOwner: boolean;
  actions?: React.ReactNode;
  /** Tag & custom field untuk kolom/filter (plan 2.1). */
  custom?: ListCustomization;
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerName = new Map(owners.map((o) => [o.userId, o.name]));
  const canCreate = can("create", "Company");

  const customColumns = useCustomColumns<CompanyRow>(custom);
  const columns: ColumnDef<CompanyRow, unknown>[] = [
    { header: "Perusahaan", accessorKey: "name", meta: { sortKey: "name" } },
    {
      header: "Industri",
      accessorKey: "industry",
      meta: { sortKey: "industry" },
      cell: (c) => c.row.original.industry ?? "—",
    },
    { header: "Email", accessorKey: "email", cell: (c) => c.row.original.email ?? "—" },
    { header: "Telepon", accessorKey: "phone", cell: (c) => c.row.original.phone ?? "—" },
    {
      header: "Contact",
      id: "contacts",
      meta: { className: "tabular-nums" },
      cell: (c) => c.row.original._count.contacts,
    },
    {
      header: "PIC",
      id: "owner",
      cell: (c) => (c.row.original.ownerId && ownerName.get(c.row.original.ownerId)) || "—",
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
        {actions}
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Tambah company
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={[...columns, ...customColumns]}
        rowHref={(r) => `/companies/${r.id}`}
        searchPlaceholder="Cari nama, industri, email…"
        toolbar={
          <>
            <UrlFilterSelect
              param="owner"
              label="Filter PIC"
              allLabel="Semua PIC"
              options={owners.map((o) => ({ value: o.userId, label: o.name }))}
            />
            <CustomizationFilters custom={custom} />
          </>
        }
        empty={
          <EmptyState
            icon={Building2}
            title="Belum ada company"
            description="Tambahkan perusahaan pelanggan atau prospek pertama Anda."
          >
            {canCreate && <Button onClick={() => setOpen(true)}>Tambah company</Button>}
          </EmptyState>
        }
      />
      <EntitySheet
        open={open}
        onOpenChange={setOpen}
        title="Company baru"
        description="Quick add — lengkapi nanti di halaman detail."
      >
        {open && (
          <CompanyForm
            owners={owners}
            canAssignOwner={canAssignOwner}
            onDone={(id) => {
              setOpen(false);
              if (id) router.push(`/companies/${id}`);
              else router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
