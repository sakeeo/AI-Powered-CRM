"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteEntityButton } from "@/components/shared/delete-entity-button";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/modules/companies/components/company-form";
import type { OwnerOption } from "@/modules/contacts/components/contact-form";
import type { CompanyInput } from "@/modules/contacts/schemas";
import { deleteCompany } from "@/modules/companies/server/actions";

export function CompanyActions({
  id,
  name,
  defaults,
  owners,
  canEdit,
  canDelete,
  canAssignOwner,
}: {
  id: string;
  name: string;
  defaults: Partial<CompanyInput>;
  owners: OwnerOption[];
  canEdit: boolean;
  canDelete: boolean;
  canAssignOwner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2">
      {canEdit && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Pencil /> Ubah
        </Button>
      )}
      {canDelete && (
        <DeleteEntityButton
          action={deleteCompany}
          id={id}
          entity="Company"
          name={name}
          redirectTo="/companies"
        />
      )}
      <EntitySheet open={open} onOpenChange={setOpen} title="Ubah company">
        {open && (
          <CompanyForm
            companyId={id}
            defaults={defaults}
            owners={owners}
            canAssignOwner={canAssignOwner}
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
