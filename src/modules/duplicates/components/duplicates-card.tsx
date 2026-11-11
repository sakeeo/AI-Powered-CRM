"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { mergeCompanies, mergeContacts, mergeLeads } from "@/modules/duplicates/server/actions";
import type { DuplicateMatch } from "@/modules/duplicates/server/detect";

const MERGE = { lead: mergeLeads, contact: mergeContacts, company: mergeCompanies } as const;
const PATH = { lead: "leads", contact: "contacts", company: "companies" } as const;

/** Kartu duplikat pada halaman detail + merge MANUAL (pengguna memilih record yang dipertahankan). */
export function DuplicatesCard({
  entity,
  currentId,
  currentName,
  matches,
  canMerge,
}: {
  entity: "lead" | "contact" | "company";
  currentId: string;
  currentName: string;
  matches: DuplicateMatch[];
  canMerge: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<DuplicateMatch | null>(null);
  const [keepCurrent, setKeepCurrent] = useState(true);
  const [fillEmpty, setFillEmpty] = useState(true);
  const [pending, start] = useTransition();
  if (!matches.length) return null;

  function merge() {
    if (!target) return;
    const keepId = keepCurrent ? currentId : target.id;
    const mergeId = keepCurrent ? target.id : currentId;
    start(async () => {
      const res = await MERGE[entity]({ keepId, mergeId, fillEmpty });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Record digabung");
      setTarget(null);
      router.push(`/${PATH[entity]}/${keepId}`);
      router.refresh();
    });
  }

  return (
    <Card className="border-tone-orange-border">
      <CardHeader className="block">
        <CardTitle>Kemungkinan duplikat ({matches.length})</CardTitle>
        <CardDescription>
          Hanya peringatan. Anda yang memutuskan apakah akan digabung.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y rounded-lg border">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="text-sm">
                <a className="text-primary font-medium hover:underline" href={m.href}>
                  {m.name}
                </a>
                <span className="text-muted-foreground text-xs">
                  {" "}
                  · {[m.email, m.phone, m.detail].filter(Boolean).join(" · ")}
                </span>
              </div>
              {canMerge && (
                <Button size="sm" variant="outline" onClick={() => setTarget(m)}>
                  Gabungkan…
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gabungkan record</DialogTitle>
            <DialogDescription>
              Relasi (deal, company, dst.) dipindahkan; record yang digabung diarsipkan, bukan
              dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Pertahankan yang mana?</p>
            <label className="flex items-center gap-2">
              <input type="radio" checked={keepCurrent} onChange={() => setKeepCurrent(true)} />{" "}
              {currentName} (halaman ini)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!keepCurrent} onChange={() => setKeepCurrent(false)} />{" "}
              {target?.name}
            </label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="fill-empty"
                checked={fillEmpty}
                onCheckedChange={(v) => setFillEmpty(!!v)}
              />
              <Label htmlFor="fill-empty">Isi field kosong dari record yang digabung</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button onClick={merge} disabled={pending}>
              {pending ? "Menggabung…" : "Gabungkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
