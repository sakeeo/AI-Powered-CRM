"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteEntityButton } from "@/components/shared/delete-entity-button";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { Button } from "@/components/ui/button";
import {
  ContactForm,
  type Option,
  type OwnerOption,
} from "@/modules/contacts/components/contact-form";
import type { ContactInput } from "@/modules/contacts/schemas";
import { deleteContact } from "@/modules/contacts/server/actions";

export function ContactActions({
  id,
  name,
  defaults,
  companies,
  owners,
  canEdit,
  canDelete,
  canAssignOwner,
}: {
  id: string;
  name: string;
  defaults: Partial<ContactInput>;
  companies: Option[];
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
          action={deleteContact}
          id={id}
          entity="Contact"
          name={name}
          redirectTo="/contacts"
        />
      )}
      <EntitySheet open={open} onOpenChange={setOpen} title="Ubah contact">
        {open && (
          <ContactForm
            contactId={id}
            defaults={defaults}
            companies={companies}
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
