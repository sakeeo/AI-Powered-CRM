"use client";

import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { RowAction } from "@/components/shared/row-action";
import { deleteFeedback, setFeedbackStatus } from "@/modules/feedback/server/actions";

export function FeedbackActions({
  id,
  status,
  ownerId,
}: {
  id: string;
  status: string;
  ownerId: string | null;
}) {
  const can = useCan();
  const router = useRouter();
  const [pending, start] = useTransition();
  const rec = { ownerId };
  if (!can("update", "Feedback", rec)) return null;
  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error("Gagal");
      else router.refresh();
    });
  return (
    <div className="flex gap-1">
      <RowAction
        icon={status === "open" ? CheckCircle2 : RotateCcw}
        label={status === "open" ? "Selesaikan" : "Buka lagi"}
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => setFeedbackStatus({ id, status: status === "open" ? "resolved" : "open" }))
        }
      />
      {can("delete", "Feedback", rec) && (
        <RowAction
          icon={Trash2}
          label="Hapus"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => deleteFeedback({ id }))}
        />
      )}
    </div>
  );
}
