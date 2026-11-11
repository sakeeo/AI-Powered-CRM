"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { Badge } from "@/components/ui/badge";
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
  createLeadSource,
  renameLeadSource,
  toggleLeadSource,
} from "@/modules/leads/server/actions";

export type SourceRow = {
  id: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  leadCount: number;
};

function Row({ s, canEdit }: { s: SourceRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await renameLeadSource({ id: s.id, name });
              if (!res.ok) toast.error(res.fieldErrors?.name ?? res.error);
              else {
                toast.success("Nama sumber diubah");
                setEditing(false);
              }
            });
          }}
        >
          <Input
            aria-label="Nama sumber"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-48"
          />
          <Button size="sm" type="submit" disabled={pending}>
            Simpan
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={() => setEditing(false)}>
            Batal
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className={s.isActive ? "text-sm" : "text-muted-foreground text-sm line-through"}>
            {s.name}
          </span>
          {s.isSystem && <Badge variant="outline">Sistem</Badge>}
          <span className="text-muted-foreground text-xs tabular-nums">{s.leadCount} lead</span>
        </div>
      )}
      {canEdit && !editing && !s.isSystem && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Ubah nama
          </Button>
          <Button
            size="sm"
            variant={s.isActive ? "destructive" : "outline"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await toggleLeadSource({ id: s.id, isActive: !s.isActive });
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            {s.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      )}
    </li>
  );
}

export function LeadSourcesPanel({ sources }: { sources: SourceRow[] }) {
  const can = useCan();
  const canEdit = can("update", "LeadSource");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Lead Source</CardTitle>
          <CardDescription>
            Dari mana lead Anda berasal. Sumber nonaktif tidak muncul di form lead baru.
          </CardDescription>
        </div>
        {can("create", "LeadSource") && (
          <CardAction>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await createLeadSource({ name });
                  if (!res.ok) toast.error(res.fieldErrors?.name ?? res.error);
                  else {
                    toast.success("Sumber ditambahkan");
                    setName("");
                  }
                });
              }}
            >
              <Input
                aria-label="Nama sumber baru"
                placeholder="Sumber baru"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-44"
                required
              />
              <Button type="submit" disabled={pending}>
                Tambah
              </Button>
            </form>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y rounded-lg border">
          {sources.map((s) => (
            <Row key={s.id} s={s} canEdit={canEdit} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
