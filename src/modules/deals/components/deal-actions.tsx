"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DeleteEntityButton } from "@/components/shared/delete-entity-button";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { DealForm, type Opt, type OwnerOpt } from "@/modules/deals/components/deal-form";
import type { DealInput } from "@/modules/deals/schemas";
import { deleteDeal, moveDealStage } from "@/modules/deals/server/actions";

export function DealActions({
  id,
  title,
  stageId,
  open: isOpen,
  defaults,
  contacts,
  companies,
  stages,
  owners,
  canEdit,
  canDelete,
  canAssignOwner,
  defaultCurrency,
  extra,
}: {
  id: string;
  title: string;
  stageId: string;
  open: boolean;
  defaults: Partial<DealInput>;
  contacts: Opt[];
  companies: Opt[];
  stages: Opt[];
  owners: OwnerOpt[];
  canEdit: boolean;
  canDelete: boolean;
  canAssignOwner: boolean;
  defaultCurrency: string;
  /** Tombol tambahan (Won/Lost) dari plan 1.10. */
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && isOpen && (
        <div className="w-52">
          <SelectField
            value={stageId}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(v) =>
              v &&
              start(async () => {
                const res = await moveDealStage({ id, stageId: v });
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Stage diperbarui");
                  router.refresh();
                }
              })
            }
            disabled={pending}
          />
        </div>
      )}
      {extra}
      {canEdit && isOpen && (
        <Button variant="outline" onClick={() => setEdit(true)}>
          <Pencil /> Ubah
        </Button>
      )}
      {canDelete && (
        <DeleteEntityButton
          action={deleteDeal}
          id={id}
          entity="Deal"
          name={title}
          redirectTo="/deals"
        />
      )}
      <EntitySheet open={edit} onOpenChange={setEdit} title="Ubah deal">
        {edit && (
          <DealForm
            dealId={id}
            defaults={defaults}
            contacts={contacts}
            companies={companies}
            stages={stages}
            owners={owners}
            canAssignOwner={canAssignOwner}
            defaultCurrency={defaultCurrency}
            onDone={() => {
              setEdit(false);
              router.refresh();
            }}
          />
        )}
      </EntitySheet>
    </div>
  );
}
