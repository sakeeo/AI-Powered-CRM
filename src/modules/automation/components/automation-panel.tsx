"use client";

import { Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { RowAction } from "@/components/shared/row-action";
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
import {
  ACTION_LABEL,
  MAX_ACTIONS,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  TRIGGERS,
  TRIGGER_ACTIONS,
  TRIGGER_LABEL,
  type ActionType,
  type Trigger,
} from "@/modules/automation/constants";
import type { AutomationAction, RuleInput } from "@/modules/automation/schemas";
import {
  createRule,
  deleteRule,
  toggleRule,
  updateRule,
} from "@/modules/automation/server/actions";
import type { RuleDto, RunDto } from "@/modules/automation/server/queries";

type Owner = { userId: string; name: string };

const blank = (type: ActionType, owners: Owner[]): AutomationAction =>
  type === "assign_owner"
    ? { type, userIds: owners[0] ? [owners[0].userId] : [], onlyIfUnassigned: true }
    : type === "create_task"
      ? { type, subject: "Follow up {{name}}", dueInDays: 1, assignTo: "owner" }
      : { type, title: "Perlu perhatian: {{name}}", to: "owner" };

function ActionEditor({
  action,
  owners,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  owners: Owner[];
  onChange: (a: AutomationAction) => void;
  onRemove: () => void;
}) {
  const people = [
    { value: "owner", label: "Owner record" },
    ...owners.map((o) => ({ value: o.userId, label: o.name })),
  ];
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{ACTION_LABEL[action.type]}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Hapus aksi"
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      {action.type === "assign_owner" && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">
            Pilih satu pengguna, atau beberapa untuk bergiliran (round-robin). Hanya bila record
            belum punya owner.
          </p>
          <div className="flex flex-wrap gap-2">
            {owners.map((o) => {
              const on = action.userIds.includes(o.userId);
              return (
                <button
                  key={o.userId}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      ...action,
                      userIds: on
                        ? action.userIds.filter((u) => u !== o.userId)
                        : [...action.userIds, o.userId],
                    })
                  }
                  className={
                    on
                      ? "bg-secondary text-primary h-8 rounded-3xl px-3 text-sm font-medium"
                      : "text-muted-foreground hover:bg-secondary h-8 rounded-3xl border px-3 text-sm"
                  }
                >
                  {o.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {action.type === "create_task" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              aria-label="Subjek task"
              value={action.subject}
              onChange={(e) => onChange({ ...action, subject: e.target.value })}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Gunakan {"{{name}}"} untuk nama record.
            </p>
          </div>
          <Input
            aria-label="Jatuh tempo (hari)"
            type="number"
            min={0}
            max={365}
            value={action.dueInDays}
            onChange={(e) => onChange({ ...action, dueInDays: Number(e.target.value) })}
          />
          <SelectField
            value={action.assignTo}
            onChange={(v) => onChange({ ...action, assignTo: (v || "owner") as never })}
            options={people}
          />
        </div>
      )}
      {action.type === "send_notification" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              aria-label="Judul notifikasi"
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
            />
          </div>
          <Input
            aria-label="Isi notifikasi"
            placeholder="Isi (opsional)"
            value={action.body ?? ""}
            onChange={(e) => onChange({ ...action, body: e.target.value || undefined })}
          />
          <SelectField
            value={action.to}
            onChange={(v) => onChange({ ...action, to: (v || "owner") as never })}
            options={people}
          />
        </div>
      )}
    </div>
  );
}

type Draft = { id?: string } & RuleInput;

function RuleDialog({
  draft,
  setDraft,
  owners,
  onClose,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  owners: Owner[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowed = TRIGGER_ACTIONS[draft.trigger];
  const actions = draft.actions as AutomationAction[];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = draft.id ? await updateRule({ ...draft, id: draft.id }) : await createRule(draft);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.fieldErrors ? "Periksa isian rule" : res.error);
        return;
      }
      toast.success(draft.id ? "Rule diperbarui" : "Rule dibuat");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Ubah rule" : "Rule baru"}</DialogTitle>
          <DialogDescription>
            Ketika trigger terjadi, aksi dijalankan otomatis (sekali per kejadian).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField id="rule-name" label="Nama rule" error={errors.name}>
            <Input
              id="rule-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </FormField>
          <FormField id="rule-trigger" label="Ketika">
            <SelectField
              id="rule-trigger"
              value={draft.trigger}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  trigger: v as Trigger,
                  actions: actions.filter((a) => TRIGGER_ACTIONS[v as Trigger].includes(a.type)),
                })
              }
              options={TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABEL[t] }))}
            />
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">Maka</p>
            {errors.actions && <p className="text-tone-red-ink text-xs">{errors.actions}</p>}
            {actions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                owners={owners}
                onChange={(n) =>
                  setDraft({ ...draft, actions: actions.map((x, j) => (j === i ? n : x)) })
                }
                onRemove={() => setDraft({ ...draft, actions: actions.filter((_, j) => j !== i) })}
              />
            ))}
            {actions.length < MAX_ACTIONS && (
              <SelectField
                value=""
                onChange={(v) =>
                  v && setDraft({ ...draft, actions: [...actions, blank(v as ActionType, owners)] })
                }
                placeholder="+ Tambah aksi…"
                options={allowed.map((t) => ({ value: t, label: ACTION_LABEL[t] }))}
              />
            )}
          </div>
          <FormField
            id="rule-max"
            label="Batas eksekusi per jam"
            hint="Pengaman agar rule tidak berjalan tak terkendali."
          >
            <Input
              id="rule-max"
              type="number"
              min={1}
              max={1000}
              value={draft.maxPerHour}
              onChange={(e) => setDraft({ ...draft, maxPerHour: Number(e.target.value) })}
            />
          </FormField>
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

export function AutomationPanel({
  rules,
  runs,
  owners,
}: {
  rules: RuleDto[];
  runs: RunDto[];
  owners: Owner[];
}) {
  const can = useCan();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const canEdit = can("update", "Automation");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Workflow Automation</CardTitle>
            <CardDescription>
              Rule sederhana: kejadian → aksi. Tanpa aksi AI otonom; setiap eksekusi tercatat di log
              dan tidak pernah berjalan dua kali untuk kejadian yang sama.
            </CardDescription>
          </div>
          {can("create", "Automation") && (
            <CardAction>
              <Button
                onClick={() =>
                  setDraft({
                    name: "",
                    trigger: "lead_created",
                    actions: [],
                    maxPerHour: 100,
                    isActive: true,
                  })
                }
              >
                <Plus /> Rule baru
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Belum ada rule.</p>
          ) : (
            <ul className="divide-border divide-y rounded-lg border">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <ToneBadge tone={r.isActive ? "green" : "orange"}>
                        {r.isActive ? "Aktif" : "Nonaktif"}
                      </ToneBadge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {TRIGGER_LABEL[r.trigger]} →{" "}
                      {r.actions.map((a) => ACTION_LABEL[a.type]).join(", ")} · {r.runCount}×
                      dijalankan · maks. {r.maxPerHour}/jam
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5">
                      <RowAction
                        icon={r.isActive ? PowerOff : Power}
                        label={r.isActive ? "Nonaktifkan" : "Aktifkan"}
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await toggleRule({ id: r.id, isActive: !r.isActive });
                            if (!res.ok) toast.error(res.error);
                          })
                        }
                      />
                      <RowAction
                        icon={Pencil}
                        label="Ubah"
                        variant="outline"
                        onClick={() =>
                          setDraft({
                            id: r.id,
                            name: r.name,
                            trigger: r.trigger,
                            actions: r.actions,
                            maxPerHour: r.maxPerHour,
                            isActive: r.isActive,
                          })
                        }
                      />
                      {can("delete", "Automation") && (
                        <RowAction
                          icon={Trash2}
                          label="Hapus"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm(`Hapus rule “${r.name}” beserta lognya?`)) return;
                            start(async () => {
                              const res = await deleteRule({ id: r.id });
                              if (!res.ok) toast.error(res.error);
                            });
                          }}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log eksekusi</CardTitle>
          <CardDescription>50 eksekusi terakhir.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Belum ada eksekusi.</p>
          ) : (
            <ul className="divide-border divide-y rounded-lg border" data-testid="automation-log">
              {runs.map((r) => (
                <li key={r.id} className="space-y-1 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={RUN_STATUS_TONE[r.status] ?? "blue"}>
                      {RUN_STATUS_LABEL[r.status] ?? r.status}
                    </ToneBadge>
                    <span className="font-medium">{r.ruleName}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {new Date(r.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {r.results
                      .map((x) => `${ACTION_LABEL[x.type as ActionType] ?? x.type}: ${x.message}`)
                      .join(" · ")}
                    {r.error && ` — ${r.error}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {draft && (
        <RuleDialog
          draft={draft}
          setDraft={setDraft}
          owners={owners}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
