"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { describeRules, type SegmentRules } from "@/modules/customers/segment-rules";
import {
  createDynamicSegment,
  deleteDynamicSegment,
  updateDynamicSegment,
} from "@/modules/customers/server/segment-actions";

type Tag = { id: string; name: string };
type Seg = { id: string; name: string; rules: SegmentRules };

type Draft = {
  id?: string;
  name: string;
  party: "all" | "company" | "contact";
  minTotal: string;
  maxTotal: string;
  minWonCount: string;
  recency: "none" | "within" | "inactive";
  days: string;
  tagIds: string[];
};
const blank: Draft = {
  name: "",
  party: "all",
  minTotal: "",
  maxTotal: "",
  minWonCount: "",
  recency: "none",
  days: "90",
  tagIds: [],
};
const toDraft = (s: Seg): Draft => ({
  id: s.id,
  name: s.name,
  party: s.rules.party,
  minTotal: s.rules.minTotal?.toString() ?? "",
  maxTotal: s.rules.maxTotal?.toString() ?? "",
  minWonCount: s.rules.minWonCount?.toString() ?? "",
  recency: s.rules.wonWithinDays ? "within" : s.rules.inactiveDays ? "inactive" : "none",
  days: String(s.rules.wonWithinDays ?? s.rules.inactiveDays ?? 90),
  tagIds: s.rules.tagIds ?? [],
});
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function SegmentDialog({
  draft,
  tags,
  onClose,
}: {
  draft: Draft;
  tags: Tag[];
  onClose: () => void;
}) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const days = Number(d.days);
    const rules = {
      party: d.party,
      minTotal: num(d.minTotal),
      maxTotal: num(d.maxTotal),
      minWonCount: num(d.minWonCount),
      wonWithinDays: d.recency === "within" ? days : undefined,
      inactiveDays: d.recency === "inactive" ? days : undefined,
      tagIds: d.tagIds.length ? d.tagIds : undefined,
    };
    start(async () => {
      const res = d.id
        ? await updateDynamicSegment({ id: d.id, name: d.name, rules })
        : await createDynamicSegment({ name: d.name, rules });
      if (!res.ok) return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      toast.success("Segmen disimpan");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{d.id ? "Ubah segmen dinamis" : "Segmen dinamis baru"}</DialogTitle>
            <DialogDescription>
              Anggota dihitung otomatis dari aturan (semua kriteria harus terpenuhi).
            </DialogDescription>
          </DialogHeader>
          <FormField id="seg-name" label="Nama segmen">
            <Input
              id="seg-name"
              value={d.name}
              maxLength={40}
              onChange={(e) => set({ name: e.target.value })}
            />
          </FormField>
          <FormField id="seg-party" label="Jenis customer">
            <SelectField
              id="seg-party"
              value={d.party}
              onChange={(v) => set({ party: v as Draft["party"] })}
              options={[
                { value: "all", label: "Company & contact" },
                { value: "company", label: "Hanya company" },
                { value: "contact", label: "Hanya contact" },
              ]}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="seg-min" label="Total belanja ≥">
              <Input
                id="seg-min"
                type="number"
                min={0}
                value={d.minTotal}
                onChange={(e) => set({ minTotal: e.target.value })}
              />
            </FormField>
            <FormField id="seg-max" label="Total belanja ≤">
              <Input
                id="seg-max"
                type="number"
                min={0}
                value={d.maxTotal}
                onChange={(e) => set({ maxTotal: e.target.value })}
              />
            </FormField>
            <FormField id="seg-count" label="Deal Won ≥">
              <Input
                id="seg-count"
                type="number"
                min={1}
                value={d.minWonCount}
                onChange={(e) => set({ minWonCount: e.target.value })}
              />
            </FormField>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Total dalam mata uang default organisasi.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="seg-recency" label="Recency pembelian">
              <SelectField
                id="seg-recency"
                value={d.recency}
                onChange={(v) => set({ recency: v as Draft["recency"] })}
                options={[
                  { value: "none", label: "Tidak dibatasi" },
                  { value: "within", label: "Membeli dalam N hari terakhir" },
                  { value: "inactive", label: "Tidak membeli ≥ N hari" },
                ]}
              />
            </FormField>
            {d.recency !== "none" && (
              <FormField id="seg-days" label="N (hari)">
                <Input
                  id="seg-days"
                  type="number"
                  min={1}
                  value={d.days}
                  onChange={(e) => set({ days: e.target.value })}
                />
              </FormField>
            )}
          </div>
          {tags.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Punya salah satu tag</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const on = d.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set({
                          tagIds: on ? d.tagIds.filter((x) => x !== t.id) : [...d.tagIds, t.id],
                        })
                      }
                      className={
                        on
                          ? "bg-secondary text-primary h-8 rounded-3xl px-3 text-sm font-medium"
                          : "text-muted-foreground hover:bg-secondary h-8 rounded-3xl border px-3 text-sm"
                      }
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-tone-red-ink text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Segmen dinamis berbasis aturan (tag, nilai belanja, recency); dapat dipakai sebagai filter dan laporan. */
export function DynamicSegmentsPanel({
  segments,
  tags,
  canManage,
}: {
  segments: Seg[];
  tags: Tag[];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const tagNames = new Map(tags.map((t) => [t.id, t.name]));
  if (!segments.length && !canManage) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Segmen dinamis</CardTitle>
          <CardDescription>
            Keanggotaan dihitung otomatis dari aturan sehingga selalu mutakhir. Pakai sebagai filter
            di tabel dan lihat ringkasannya di laporan Segmen Pelanggan.
          </CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button onClick={() => setDraft(blank)}>
              <Plus /> Segmen baru
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {segments.length === 0 ? (
          <p className="text-muted-foreground py-3 text-sm">Belum ada segmen dinamis.</p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="dynamic-segments-list">
            {segments.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ToneBadge tone="purple">{s.name}</ToneBadge>
                    <Link
                      className="text-primary text-xs hover:underline"
                      href={`/customers?segment=${s.id}`}
                    >
                      Lihat anggota
                    </Link>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {describeRules(s.rules, tagNames)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(s))}>
                      <Pencil /> Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteDynamicSegment({ id: s.id });
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Segmen dihapus");
                        })
                      }
                    >
                      <Trash2 /> Hapus
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {draft && (
        <SegmentDialog
          key={draft.id ?? "new"}
          draft={draft}
          tags={tags}
          onClose={() => setDraft(null)}
        />
      )}
    </Card>
  );
}
