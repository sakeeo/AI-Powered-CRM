"use client";

import { Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createActivity } from "@/modules/activities/server/actions";
import { assignSegment, removeSegment } from "@/modules/customers/server/actions";
import { aiCustomerBriefing } from "@/modules/customers/server/ai-actions";
import type { BriefingBullet } from "@/modules/customers/server/ai";

type Party = { type: "company" | "contact"; id: string };

export function SegmentsEditor({
  party,
  segments,
  all,
  canEdit,
}: {
  party: Party;
  segments: { id: string; name: string }[];
  all: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" data-testid="segments">
        {segments.length === 0 && (
          <span className="text-muted-foreground text-xs">Belum ada segmen.</span>
        )}
        {segments.map((s) => (
          <ToneBadge key={s.id} tone="orange">
            <span className="inline-flex items-center gap-1">
              {s.name}
              {canEdit && (
                <button
                  aria-label={`Hapus segmen ${s.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await removeSegment({ ...party, segmentId: s.id });
                      if (!res.ok) toast.error(res.error);
                      else router.refresh();
                    })
                  }
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          </ToneBadge>
        ))}
      </div>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await assignSegment({ ...party, name });
              if (!res.ok) return void toast.error(res.fieldErrors?.name ?? res.error);
              setName("");
              router.refresh();
            });
          }}
        >
          <Input
            aria-label="Segmen baru"
            list="segment-options"
            placeholder="Tambah segmen…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <datalist id="segment-options">
            {all.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <Button type="submit" size="sm" disabled={pending || name.trim().length < 2}>
            Tambah
          </Button>
        </form>
      )}
    </div>
  );
}

/** Jadwalkan task pasca-penjualan / renewal (membuat Activity task biasa yang tertaut ke customer). */
export function FollowUpScheduler({ party, name }: { party: Party; name: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"followup" | "renewal" | null>(null);
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const link = party.type === "company" ? { companyId: party.id } : { contactId: party.id };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setKind("followup")}>
          Follow-up pasca-penjualan
        </Button>
        <Button size="sm" variant="outline" onClick={() => setKind("renewal")}>
          Renewal reminder
        </Button>
      </div>
      {kind && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createActivity({
                type: "task",
                subject:
                  kind === "renewal" ? `Renewal: ${name}` : `Follow-up pasca-penjualan: ${name}`,
                dueLocal: due,
                ...link,
              });
              if (!res.ok) return void toast.error(res.fieldErrors?.dueLocal ?? res.error);
              toast.success("Task dijadwalkan");
              setKind(null);
              setDue("");
              router.refresh();
            });
          }}
        >
          <label className="text-xs">
            Tanggal {kind === "renewal" ? "renewal" : "follow-up"}
            <Input type="date" required value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <Button type="submit" size="sm" disabled={pending || !due}>
            Jadwalkan
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setKind(null)}>
            Batal
          </Button>
        </form>
      )}
    </div>
  );
}

export function BriefingCard({ party }: { party: Party }) {
  const [bullets, setBullets] = useState<BriefingBullet[]>([]);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await aiCustomerBriefing(party);
            if (!res.ok) return void toast.error(res.error);
            setBullets(res.data.bullets);
          })
        }
      >
        <Sparkles /> {pending ? "Menyusun…" : "Briefing AI"}
      </Button>
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="briefing">
          {bullets.map((b) => (
            <li key={b.kind}>
              {b.text}
              <span className="text-muted-foreground ml-1 text-xs">
                {b.source === "code" ? "(dihitung sistem)" : "(draf AI)"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
