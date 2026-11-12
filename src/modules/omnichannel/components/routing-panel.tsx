"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CHANNEL_LABEL,
  ROUTING_LABEL,
  ROUTING_STRATEGIES,
  type RoutingStrategy,
} from "@/modules/omnichannel/constants";
import { saveChannelRouting } from "@/modules/omnichannel/server/actions";
import type { RoutingRow } from "@/modules/omnichannel/server/queries";

type Owner = { userId: string; name: string };

function KindRow({ row, owners, canEdit }: { row: RoutingRow; owners: Owner[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [strategy, setStrategy] = useState<RoutingStrategy>(row.strategy);
  const [pool, setPool] = useState<string[]>(row.pool);
  const toggle = (id: string) =>
    setPool((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <li className="space-y-3 px-4 py-4" data-testid={`routing-${row.kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{CHANNEL_LABEL[row.kind]}</p>
          <p className="text-muted-foreground text-xs">{ROUTING_LABEL[strategy].description}</p>
        </div>
        <div className="w-60">
          <SelectField
            id={`strategy-${row.kind}`}
            value={strategy}
            disabled={!canEdit}
            onChange={(v) => setStrategy((v || "none") as RoutingStrategy)}
            options={ROUTING_STRATEGIES.map((s) => ({ value: s, label: ROUTING_LABEL[s].title }))}
          />
        </div>
      </div>
      {strategy !== "none" && (
        <div>
          <p className="text-muted-foreground mb-1.5 text-xs">
            Pool penerima (kosong = semua anggota aktif non-viewer)
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {owners.map((o) => (
              <Label key={o.userId} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={pool.includes(o.userId)}
                  disabled={!canEdit}
                  onCheckedChange={() => toggle(o.userId)}
                />
                {o.name}
              </Label>
            ))}
          </div>
        </div>
      )}
      {canEdit && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveChannelRouting({ kind: row.kind, strategy, pool });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Aturan routing disimpan");
                router.refresh();
              }
            })
          }
        >
          Simpan
        </Button>
      )}
    </li>
  );
}

/** Settings → Routing: aturan penugasan percakapan baru per kanal. */
export function RoutingPanel({
  rows,
  owners,
  canEdit,
}: {
  rows: RoutingRow[];
  owners: Owner[];
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Routing percakapan</CardTitle>
          <CardDescription>
            Menentukan siapa yang menerima percakapan BARU di tiap kanal. Tidak ada balasan
            otomatis; penerima mendapat notifikasi dan membalas sendiri.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <KindRow key={r.kind} row={r} owners={owners} canEdit={canEdit} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
