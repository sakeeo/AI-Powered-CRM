"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquareHeart, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { DataTable, UrlFilterSelect, type DataTableProps } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PageActions } from "@/components/shared/page-actions";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { FeedbackActions } from "@/modules/feedback/components/feedback-actions";
import { FeedbackForm } from "@/modules/feedback/components/feedback-form";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABEL } from "@/modules/feedback/schemas";

export type FeedbackRow = {
  id: string;
  type: string;
  subject: string;
  status: string;
  ownerId: string | null;
  createdAt: Date;
  contact: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
};
type Opt = { id: string; name: string };

export function FeedbackTable({
  table,
  contacts,
  companies,
}: {
  table: Omit<DataTableProps<FeedbackRow>, "columns" | "empty" | "toolbar">;
  contacts: Opt[];
  companies: Opt[];
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const columns: ColumnDef<FeedbackRow, unknown>[] = [
    { header: "Judul", accessorKey: "subject", meta: { sortKey: "subject" } },
    {
      header: "Jenis",
      id: "type",
      cell: (c) => (
        <ToneBadge tone={c.row.original.type === "complaint" ? "red" : "blue"}>
          {FEEDBACK_TYPE_LABEL[c.row.original.type as "feedback"] ?? c.row.original.type}
        </ToneBadge>
      ),
    },
    {
      header: "Customer",
      id: "customer",
      cell: (c) => {
        const r = c.row.original;
        const href = r.company
          ? `/customers/company/${r.company.id}`
          : r.contact
            ? `/customers/contact/${r.contact.id}`
            : null;
        const name = r.company?.name ?? r.contact?.name ?? "—";
        return href ? (
          <Link className="text-primary hover:underline" href={href}>
            {name}
          </Link>
        ) : (
          name
        );
      },
    },
    {
      header: "Status",
      id: "status",
      cell: (c) => (
        <ToneBadge tone={c.row.original.status === "open" ? "orange" : "green"}>
          {c.row.original.status === "open" ? "Terbuka" : "Selesai"}
        </ToneBadge>
      ),
    },
    {
      header: "Dibuat",
      accessorKey: "createdAt",
      meta: { sortKey: "createdAt", className: "tabular-nums" },
      cell: (c) => new Date(c.row.original.createdAt).toLocaleDateString("id-ID"),
    },
    {
      header: "",
      id: "actions",
      cell: (c) => (
        <FeedbackActions
          id={c.row.original.id}
          status={c.row.original.status}
          ownerId={c.row.original.ownerId}
        />
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <PageActions>
        {can("create", "Feedback") && (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Catat feedback
          </Button>
        )}
      </PageActions>
      <DataTable
        {...table}
        columns={columns}
        searchPlaceholder="Cari judul, detail, customer…"
        toolbar={
          <>
            <UrlFilterSelect
              param="type"
              label="Filter jenis"
              allLabel="Semua jenis"
              options={FEEDBACK_TYPES.map((t) => ({ value: t, label: FEEDBACK_TYPE_LABEL[t] }))}
            />
            <UrlFilterSelect
              param="status"
              label="Filter status"
              allLabel="Semua status"
              options={[
                { value: "open", label: "Terbuka" },
                { value: "resolved", label: "Selesai" },
              ]}
            />
          </>
        }
        empty={
          <EmptyState
            icon={MessageSquareHeart}
            title="Belum ada feedback"
            description="Catat feedback dan complaint pelanggan di sini."
          />
        }
      />
      <EntitySheet open={open} onOpenChange={setOpen} title="Catat feedback / complaint">
        {open && (
          <FeedbackForm
            contacts={contacts}
            companies={companies}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
