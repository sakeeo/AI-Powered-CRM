"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  archiveStage,
  createStage,
  renamePipeline,
  reorderStage,
  updateStage,
} from "@/modules/deals/server/actions";

export type StageRow = { id: string; name: string; probability: number };

function StageItem({
  stage,
  index,
  total,
  canEdit,
}: {
  stage: StageRow;
  index: number;
  total: number;
  canEdit: boolean;
}) {
  const [name, setName] = useState(stage.name);
  const [prob, setProb] = useState(String(stage.probability));
  const [pending, start] = useTransition();
  const dirty = name !== stage.name || prob !== String(stage.probability);
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>,
    ok?: string,
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      else if (ok) toast.success(ok);
    });
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="text-muted-foreground w-6 text-xs tabular-nums">{index + 1}</span>
      <Input
        aria-label={`Nama stage ${index + 1}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={!canEdit}
        className="h-8 w-52"
      />
      <div className="flex items-center gap-1">
        <Input
          aria-label={`Probabilitas stage ${index + 1}`}
          type="number"
          min={0}
          max={100}
          value={prob}
          onChange={(e) => setProb(e.target.value)}
          disabled={!canEdit}
          className="h-8 w-20"
        />
        <span className="text-muted-foreground text-xs">%</span>
      </div>
      {canEdit && (
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="outline"
            aria-label="Naikkan"
            disabled={pending || index === 0}
            onClick={() => run(() => reorderStage({ id: stage.id, direction: "up" }))}
          >
            <ArrowUp /> Naik
          </Button>
          <Button
            variant="outline"
            aria-label="Turunkan"
            disabled={pending || index === total - 1}
            onClick={() => run(() => reorderStage({ id: stage.id, direction: "down" }))}
          >
            <ArrowDown /> Turun
          </Button>
          <Button
            size="sm"
            disabled={pending || !dirty}
            onClick={() =>
              run(
                () => updateStage({ id: stage.id, name, probability: Number(prob) }),
                "Stage disimpan",
              )
            }
          >
            Simpan
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => archiveStage({ id: stage.id }), "Stage diarsipkan")}
          >
            Arsipkan
          </Button>
        </div>
      )}
    </li>
  );
}

export function PipelineConfig({
  pipeline,
}: {
  pipeline: { id: string; name: string; stages: StageRow[] };
}) {
  const can = useCan();
  const canEdit = can("update", "Pipeline");
  const [name, setName] = useState(pipeline.name);
  const [newName, setNewName] = useState("");
  const [newProb, setNewProb] = useState("50");
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div>
          <CardTitle>Pipeline & Stage</CardTitle>
          <CardDescription>
            Urutan dan probabilitas stage. Won dan Lost adalah hasil akhir deal, bukan stage.
          </CardDescription>
        </div>
        {canEdit && (
          <CardAction>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await renamePipeline({ id: pipeline.id, name });
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Nama pipeline disimpan");
                });
              }}
            >
              <Input
                aria-label="Nama pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-44"
              />
              <Button
                size="sm"
                type="submit"
                variant="outline"
                disabled={pending || name === pipeline.name}
              >
                Ubah nama
              </Button>
            </form>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-border divide-y rounded-lg border">
          {pipeline.stages.map((s, i) => (
            <StageItem
              key={`${s.id}-${s.name}-${s.probability}`}
              stage={s}
              index={i}
              total={pipeline.stages.length}
              canEdit={canEdit}
            />
          ))}
        </ul>
        {canEdit && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createStage({ name: newName, probability: Number(newProb) });
                if (!res.ok) toast.error(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
                else {
                  toast.success("Stage ditambahkan");
                  setNewName("");
                }
              });
            }}
          >
            <Input
              aria-label="Nama stage baru"
              placeholder="Stage baru"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 w-52"
              required
            />
            <Input
              aria-label="Probabilitas stage baru"
              type="number"
              min={0}
              max={100}
              value={newProb}
              onChange={(e) => setNewProb(e.target.value)}
              className="h-9 w-20"
            />
            <Button type="submit" disabled={pending}>
              Tambah stage
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
