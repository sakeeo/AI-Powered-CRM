"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  type ActivityType,
} from "@/modules/activities/constants";
import {
  createActivityTemplate,
  deleteActivityTemplate,
  updateActivityTemplate,
} from "@/modules/activities/server/template-actions";

export type TemplateRow = {
  id: string;
  name: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  dueInDays: number | null;
  isActive: boolean;
};
type Draft = {
  id?: string;
  name: string;
  type: ActivityType;
  subject: string;
  body: string;
  due: string;
  isActive: boolean;
};
const blank: Draft = { name: "", type: "task", subject: "", body: "", due: "", isActive: true };

const toText = (html: string | null) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text: string) =>
  text.trim()
    ? text
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("")
    : undefined;

function TemplateDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const input = {
                name: d.name,
                type: d.type,
                subject: d.subject,
                body: toHtml(d.body),
                dueInDays: d.due.trim() === "" ? null : Number(d.due),
                isActive: d.isActive,
              };
              const res = d.id
                ? await updateActivityTemplate({ id: d.id, ...input })
                : await createActivityTemplate(input);
              if (!res.ok)
                return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
              toast.success("Template disimpan");
              onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{d.id ? "Ubah template" : "Template aktivitas baru"}</DialogTitle>
            <DialogDescription>
              Dipakai ulang dari composer aktivitas di lead, contact, company, dan deal.
            </DialogDescription>
          </DialogHeader>
          <FormField id="tpl-name" label="Nama template">
            <Input
              id="tpl-name"
              value={d.name}
              maxLength={80}
              onChange={(e) => set({ name: e.target.value })}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="tpl-type" label="Jenis">
              <SelectField
                id="tpl-type"
                value={d.type}
                onChange={(v) => set({ type: v as ActivityType })}
                options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABEL[t] }))}
              />
            </FormField>
            <FormField
              id="tpl-due"
              label="Tenggat (hari sejak dipakai)"
              hint="Kosong = tanpa tenggat"
            >
              <Input
                id="tpl-due"
                type="number"
                min={0}
                max={365}
                value={d.due}
                onChange={(e) => set({ due: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="tpl-subject" label="Judul aktivitas">
            <Input
              id="tpl-subject"
              value={d.subject}
              maxLength={160}
              onChange={(e) => set({ subject: e.target.value })}
            />
          </FormField>
          <FormField id="tpl-body" label="Isi / catatan (opsional)">
            <Textarea
              id="tpl-body"
              rows={4}
              value={d.body}
              onChange={(e) => set({ body: e.target.value })}
            />
          </FormField>
          {d.id && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="tpl-active"
                checked={d.isActive}
                onCheckedChange={(c) => set({ isActive: c === true })}
              />
              <Label htmlFor="tpl-active">Aktif</Label>
            </div>
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
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesPanel({
  templates,
  canManage,
}: {
  templates: TemplateRow[];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div>
          <CardTitle>Template aktivitas</CardTitle>
          <CardDescription>
            Aktivitas yang sering dipakai (follow-up, demo, kunjungan) agar tidak mengetik ulang.
          </CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button onClick={() => setDraft(blank)}>
              <Plus /> Template baru
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Belum ada template.</p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="template-list">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="outline">{ACTIVITY_TYPE_LABEL[t.type]}</Badge>
                    {!t.isActive && <ToneBadge tone="orange">Nonaktif</ToneBadge>}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t.subject}
                    {t.dueInDays !== null && ` · tenggat ${t.dueInDays} hari`}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          id: t.id,
                          name: t.name,
                          type: t.type,
                          subject: t.subject,
                          body: toText(t.body),
                          due: t.dueInDays === null ? "" : String(t.dueInDays),
                          isActive: t.isActive,
                        })
                      }
                    >
                      <Pencil /> Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteActivityTemplate({ id: t.id });
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Template dihapus");
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
        <TemplateDialog key={draft.id ?? "new"} draft={draft} onClose={() => setDraft(null)} />
      )}
    </Card>
  );
}
