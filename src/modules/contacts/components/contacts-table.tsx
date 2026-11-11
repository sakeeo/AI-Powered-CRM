"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { Button } from "@/components/ui/button";
import {
  ContactForm,
  type Option,
  type OwnerOption,
} from "@/modules/contacts/components/contact-form";

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ownerId: string | null;
  createdAt: Date;
  companies: { company: { id: string; name: string } }[];
};

export function ContactsTable({
  table,
  companies,
  owners,
  canAssignOwner,
  actions,
}: {
  table: Omit<DataTableProps<ContactRow>, "columns" | "rowHref" | "empty" | "toolbar">;
  companies: Option[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  /** Tombol tambahan (mis. Import/Export) dari plan berikutnya. */
  actions?: React.ReactNode;
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerName = new Map(owners.map((o) => [o.userId, o.name]));
  const canCreate = can("create", "Contact");

  const columns: ColumnDef<ContactRow, unknown>[] = [
    { header: "Nama", accessorKey: "name", meta: { sortKey: "name" } },
    {
      header: "Email",
      accessorKey: "email",
      meta: { sortKey: "email" },
      cell: (c) => c.row.original.email ?? "—",
    },
    { header: "Telepon", accessorKey: "phone", cell: (c) => c.row.original.phone ?? "—" },
    {
      header: "Company",
      id: "companies",
      cell: (c) => c.row.original.companies.map((x) => x.company.name).join(", ") || "—",
    },
    {
      header: "Pemilik",
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
            <Plus /> Tambah contact
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={columns}
        rowHref={(r) => `/contacts/${r.id}`}
        searchPlaceholder="Cari nama, email, telepon…"
        toolbar={
          <UrlFilterSelect
            param="owner"
            label="Filter pemilik"
            allLabel="Semua pemilik"
            options={owners.map((o) => ({ value: o.userId, label: o.name }))}
          />
        }
        empty={
          <EmptyState
            icon={UserCircle}
            title="Belum ada contact"
            description="Tambahkan contact pertama Anda atau impor dari CSV."
          >
            {canCreate && <Button onClick={() => setOpen(true)}>Tambah contact</Button>}
          </EmptyState>
        }
      />
      <EntitySheet
        open={open}
        onOpenChange={setOpen}
        title="Contact baru"
        description="Quick add — lengkapi nanti di halaman detail."
      >
        {open && (
          <ContactForm
            companies={companies}
            owners={owners}
            canAssignOwner={canAssignOwner}
            onDone={(id) => {
              setOpen(false);
              if (id) router.push(`/contacts/${id}`);
              else router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
