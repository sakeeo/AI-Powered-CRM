"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "@/components/providers/ability-provider";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { FeedbackActions } from "@/modules/feedback/components/feedback-actions";
import { FeedbackForm } from "@/modules/feedback/components/feedback-form";

type Item = {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  status: string;
  ownerId: string | null;
  createdAt: Date;
};

export function FeedbackSection({
  items,
  fixed,
}: {
  items: Item[];
  fixed: { contactId?: string; companyId?: string };
}) {
  const can = useCan();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {can("create", "Feedback") && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Catat feedback / complaint
        </Button>
      )}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">Belum ada feedback.</p>
      ) : (
        <ul className="divide-border divide-y" data-testid="customer-feedback">
          {items.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.subject}</p>
                {f.body && (
                  <p className="text-muted-foreground text-xs whitespace-pre-wrap">{f.body}</p>
                )}
                <p className="text-muted-foreground text-xs tabular-nums">
                  {new Date(f.createdAt).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ToneBadge tone={f.type === "complaint" ? "red" : "blue"}>
                  {f.type === "complaint" ? "Complaint" : "Feedback"}
                </ToneBadge>
                <ToneBadge tone={f.status === "open" ? "orange" : "green"}>
                  {f.status === "open" ? "Terbuka" : "Selesai"}
                </ToneBadge>
                <FeedbackActions id={f.id} status={f.status} ownerId={f.ownerId} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <EntitySheet open={open} onOpenChange={setOpen} title="Catat feedback / complaint">
        {open && (
          <FeedbackForm
            contacts={[]}
            companies={[]}
            fixed={fixed}
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
