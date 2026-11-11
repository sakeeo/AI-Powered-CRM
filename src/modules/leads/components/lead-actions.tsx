"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/modules/leads/constants";
import {
  LeadForm,
  type OwnerOption,
  type SourceOption,
} from "@/modules/leads/components/lead-form";
import type { LeadInput } from "@/modules/leads/schemas";
import {
  archiveLead,
  assignLead,
  restoreLead,
  setLeadStatus,
} from "@/modules/leads/server/actions";

export function LeadActions({
  id,
  name,
  status,
  ownerId,
  archived,
  converted,
  defaults,
  sources,
  owners,
  defaultCurrency,
  canEdit,
  canArchive,
  canAssign,
  extra,
}: {
  id: string;
  name: string;
  status: string;
  ownerId: string | null;
  archived: boolean;
  converted: boolean;
  defaults: Partial<LeadInput>;
  sources: SourceOption[];
  owners: OwnerOption[];
  defaultCurrency: string;
  canEdit: boolean;
  canArchive: boolean;
  canAssign: boolean;
  /** Tombol tambahan (mis. Convert) dari plan 1.7. */
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [pending, start] = useTransition();
  const editable = canEdit && !archived;

  function changeStatus(next: LeadStatus, why?: string) {
    start(async () => {
      const res = await setLeadStatus({ id, status: next, reason: why });
      if (!res.ok) {
        if (res.fieldErrors?.reason) setReasonError(res.fieldErrors.reason);
        else toast.error(res.error);
        return;
      }
      toast.success(`Status diubah ke ${LEAD_STATUS_LABEL[next]}`);
      setReasonOpen(false);
      setReason("");
      setReasonError(undefined);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {editable && !converted && (
        <div className="w-44">
          <SelectField
            value={status}
            onChange={(v) =>
              v === "unqualified" ? setReasonOpen(true) : v && changeStatus(v as LeadStatus)
            }
            options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
          />
        </div>
      )}
      {editable && canAssign && (
        <div className="w-48">
          <SelectField
            value={ownerId ?? ""}
            noneLabel="Belum ditugaskan"
            onChange={(v) =>
              start(async () => {
                const res = await assignLead({ id, ownerId: v || null });
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Penugasan disimpan");
                  router.refresh();
                }
              })
            }
            options={owners.map((o) => ({ value: o.userId, label: o.name }))}
          />
        </div>
      )}
      {extra}
      {editable && (
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil /> Ubah
        </Button>
      )}
      {canArchive && (
        <Button
          variant={archived ? "outline" : "destructive"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = archived ? await restoreLead({ id }) : await archiveLead({ id });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success(archived ? "Lead dipulihkan" : "Lead diarsipkan");
                router.refresh();
              }
            })
          }
        >
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Pulihkan" : "Arsipkan"}
        </Button>
      )}

      <EntitySheet open={editOpen} onOpenChange={setEditOpen} title="Ubah lead">
        {editOpen && (
          <LeadForm
            leadId={id}
            defaults={defaults}
            sources={sources}
            owners={owners}
            canAssignOwner={canAssign}
            defaultCurrency={defaultCurrency}
            onDone={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        )}
      </EntitySheet>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai Unqualified</DialogTitle>
            <DialogDescription>
              Catat alasan agar tim memahami mengapa “{name}” tidak dilanjutkan.
            </DialogDescription>
          </DialogHeader>
          <FormField id="reason" label="Alasan" error={reasonError}>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>
              Batal
            </Button>
            <Button disabled={pending} onClick={() => changeStatus("unqualified", reason)}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
