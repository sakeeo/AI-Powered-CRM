"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action";

/** Tombol hapus dengan dialog konfirmasi; `action` adalah Server Action. */
export function DeleteEntityButton({
  action,
  id,
  entity,
  name,
  redirectTo,
  compact = false,
}: {
  action: (input: { id: string }) => Promise<ActionResult<unknown>>;
  id: string;
  entity: string;
  name: string;
  redirectTo: string;
  /** Aksi per item di tabel/daftar: hanya ikon di mobile/tablet. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  function confirm() {
    start(async () => {
      const res = await action({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${entity} dihapus`);
      setOpen(false);
      router.replace(redirectTo);
    });
  }
  return (
    <>
      {compact ? (
        <RowAction
          icon={Trash2}
          label="Hapus"
          variant="destructive"
          aria-label={`Hapus ${name}`}
          onClick={() => setOpen(true)}
        />
      ) : (
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 /> Hapus
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {entity}?</DialogTitle>
            <DialogDescription>
              “{name}” akan disembunyikan dari daftar. Riwayat audit tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
