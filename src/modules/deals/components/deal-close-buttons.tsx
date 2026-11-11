"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
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
import { markDealLost, markDealWon, reopenDeal } from "@/modules/deals/server/actions";

/** Aksi hasil deal: Won, Lost (alasan wajib), atau buka kembali. */
export function DealCloseButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const run = (fn: () => ReturnType<typeof markDealWon>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });

  if (status !== "open") {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(() => reopenDeal({ id }), "Deal dibuka kembali")}
      >
        Buka kembali
      </Button>
    );
  }
  return (
    <>
      <Button
        disabled={pending}
        onClick={() => run(() => markDealWon({ id }), "Deal ditandai Won")}
      >
        Won
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => setLostOpen(true)}>
        Lost
      </Button>
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai deal Lost</DialogTitle>
            <DialogDescription>
              Catat alasan agar tim bisa belajar dari deal yang kalah.
            </DialogDescription>
          </DialogHeader>
          <FormField id="lost-reason" label="Alasan" error={error}>
            <Textarea
              id="lost-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await markDealLost({ id, reason });
                  if (!res.ok) return void setError(res.fieldErrors?.reason ?? res.error);
                  toast.success("Deal ditandai Lost");
                  setLostOpen(false);
                  router.refresh();
                })
              }
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
