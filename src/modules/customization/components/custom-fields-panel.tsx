"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
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
  CONDITION_OPS,
  CONDITION_OP_LABEL,
  CUSTOM_ENTITIES,
  ENTITY_LABEL,
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  type ConditionOp,
  type CustomEntity,
  type FieldType,
} from "@/modules/customization/constants";
import { slugifyKey, type FieldDef, type FieldOption } from "@/modules/customization/custom-fields";
import {
  createCustomField,
  deleteCustomField,
  reorderCustomFields,
  updateCustomField,
} from "@/modules/customization/server/actions";

type Draft = {
  id?: string;
  label: string;
  type: FieldType;
  optionsText: string;
  required: boolean;
  showInTable: boolean;
  filterable: boolean;
  isActive: boolean;
  condKey: string;
  condOp: ConditionOp;
  condValue: string;
};

const emptyDraft: Draft = {
  label: "",
  type: "text",
  optionsText: "",
  required: false,
  showInTable: false,
  filterable: false,
  isActive: true,
  condKey: "",
  condOp: "equals",
  condValue: "",
};

const toDraft = (d: FieldDef): Draft => ({
  id: d.id,
  label: d.label,
  type: d.type,
  optionsText: d.options.map((o) => o.label).join("\n"),
  required: d.required,
  showInTable: d.showInTable,
  filterable: d.filterable,
  isActive: d.isActive,
  condKey: d.visibleWhen?.fieldKey ?? "",
  condOp: d.visibleWhen?.op ?? "equals",
  condValue: d.visibleWhen?.value ?? "",
});

/** Baris opsi (satu label per baris) → opsi; nilai lama dipertahankan untuk label yang sama. */
function parseOptions(text: string, previous: FieldOption[]): FieldOption[] {
  const used = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label) => {
      let value = previous.find((o) => o.label === label)?.value ?? (slugifyKey(label) || "opsi");
      const base = value;
      for (let i = 2; used.has(value); i++) value = `${base}_${i}`;
      used.add(value);
      return { value, label };
    });
}

function conditionText(d: FieldDef, all: FieldDef[]) {
  const c = d.visibleWhen;
  if (!c) return null;
  const parent = all.find((x) => x.key === c.fieldKey);
  const val = c.value ? (parent?.options.find((o) => o.value === c.value)?.label ?? c.value) : "";
  return `Tampil jika “${parent?.label ?? c.fieldKey}” ${CONDITION_OP_LABEL[c.op]} ${val}`.trim();
}

function FieldDialog({
  entity,
  open,
  onOpenChange,
  draft,
  setDraft,
  siblings,
  previousOptions,
}: {
  entity: CustomEntity;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: Draft;
  setDraft: (d: Draft) => void;
  siblings: FieldDef[];
  previousOptions: FieldOption[];
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!draft.id;
  const hasOptions = draft.type === "select" || draft.type === "multiselect";
  const parents = siblings.filter((s) => s.id !== draft.id);
  const parent = parents.find((p) => p.key === draft.condKey);
  const needsValue = draft.condOp === "equals" || draft.condOp === "not_equals";
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const options = hasOptions ? parseOptions(draft.optionsText, previousOptions) : [];
    const visibleWhen = draft.condKey
      ? {
          fieldKey: draft.condKey,
          op: draft.condOp,
          ...(needsValue ? { value: draft.condValue } : {}),
        }
      : null;
    start(async () => {
      const common = {
        label: draft.label,
        type: draft.type,
        options,
        required: draft.required,
        showInTable: draft.showInTable,
        filterable: draft.filterable,
        visibleWhen,
      };
      const res = editing
        ? await updateCustomField({ id: draft.id!, isActive: draft.isActive, ...common })
        : await createCustomField({ entityType: entity, ...common });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.fieldErrors ? "Periksa isian form" : res.error);
        return;
      }
      toast.success(editing ? "Field diperbarui" : "Field ditambahkan");
      setErrors({});
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah custom field" : "Custom field baru"}</DialogTitle>
          <DialogDescription>
            Untuk {ENTITY_LABEL[entity]}. Tipe tidak dapat diubah setelah dibuat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField id="cf-label" label="Label" error={errors.label}>
            <Input
              id="cf-label"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
            />
          </FormField>
          <FormField id="cf-type" label="Tipe">
            <SelectField
              id="cf-type"
              value={draft.type}
              disabled={editing}
              onChange={(v) => set({ type: v as FieldType })}
              options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))}
            />
          </FormField>
          {hasOptions && (
            <FormField
              id="cf-options"
              label="Opsi (satu per baris)"
              error={errors.options}
              hint="Mengganti nama opsi tidak mengubah data lama yang sudah tersimpan."
            >
              <Textarea
                id="cf-options"
                rows={4}
                value={draft.optionsText}
                onChange={(e) => set({ optionsText: e.target.value })}
              />
            </FormField>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["required", "Wajib diisi"],
                ["showInTable", "Tampil di tabel"],
                ["filterable", "Dapat difilter"],
              ] as const
            ).map(([k, l]) => (
              <div key={k} className="flex items-center gap-2">
                <Checkbox
                  id={`cf-${k}`}
                  checked={draft[k]}
                  onCheckedChange={(c) => set({ [k]: c === true })}
                />
                <Label htmlFor={`cf-${k}`}>{l}</Label>
              </div>
            ))}
            {editing && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cf-active"
                  checked={draft.isActive}
                  onCheckedChange={(c) => set({ isActive: c === true })}
                />
                <Label htmlFor="cf-active">Aktif</Label>
              </div>
            )}
          </div>
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Logika kondisional</legend>
            <FormField
              id="cf-cond-key"
              label="Tampilkan field ini hanya jika field"
              error={errors.visibleWhen}
            >
              <SelectField
                id="cf-cond-key"
                value={draft.condKey}
                onChange={(v) => set({ condKey: v, condValue: "" })}
                noneLabel="Selalu tampil"
                options={parents.map((p) => ({ value: p.key, label: p.label }))}
              />
            </FormField>
            {draft.condKey && (
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectField
                  value={draft.condOp}
                  onChange={(v) => set({ condOp: v as ConditionOp })}
                  options={CONDITION_OPS.map((o) => ({ value: o, label: CONDITION_OP_LABEL[o] }))}
                />
                {needsValue &&
                  (parent && (parent.type === "select" || parent.type === "multiselect") ? (
                    <SelectField
                      value={draft.condValue}
                      onChange={(v) => set({ condValue: v })}
                      placeholder="Pilih nilai"
                      options={parent.options}
                    />
                  ) : parent?.type === "boolean" ? (
                    <SelectField
                      value={draft.condValue}
                      onChange={(v) => set({ condValue: v })}
                      placeholder="Pilih nilai"
                      options={[
                        { value: "true", label: "Ya" },
                        { value: "false", label: "Tidak" },
                      ]}
                    />
                  ) : (
                    <Input
                      aria-label="Nilai pembanding"
                      value={draft.condValue}
                      onChange={(e) => set({ condValue: e.target.value })}
                    />
                  ))}
              </div>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

export function CustomFieldsPanel({ fields }: { fields: Record<CustomEntity, FieldDef[]> }) {
  const can = useCan();
  const [entity, setEntity] = useState<CustomEntity>("lead");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pending, start] = useTransition();
  const list = fields[entity];
  const previousOptions = list.find((d) => d.id === draft.id)?.options ?? [];

  function move(index: number, dir: -1 | 1) {
    const ids = list.map((d) => d.id!);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    start(async () => {
      const res = await reorderCustomFields({ entityType: entity, ids });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>
            Tambah isian sendiri pada lead, contact, company, dan deal — muncul di form, tabel,
            filter, import, dan export.
          </CardDescription>
        </div>
        {can("create", "CustomField") && (
          <CardAction>
            <Button
              onClick={() => {
                setDraft(emptyDraft);
                setOpen(true);
              }}
            >
              <Plus /> Tambah field
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="tablist" aria-label="Entitas" className="flex flex-wrap gap-1.5">
          {CUSTOM_ENTITIES.map((e) => (
            <button
              key={e}
              role="tab"
              type="button"
              aria-selected={entity === e}
              onClick={() => setEntity(e)}
              className={
                entity === e
                  ? "bg-secondary text-primary h-9 rounded-3xl px-4 text-sm font-medium"
                  : "text-muted-foreground hover:bg-secondary h-9 rounded-3xl px-4 text-sm"
              }
            >
              {ENTITY_LABEL[e]} ({fields[e].length})
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada custom field untuk {ENTITY_LABEL[entity]}.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {list.map((d, i) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        d.isActive
                          ? "text-sm font-medium"
                          : "text-muted-foreground text-sm line-through"
                      }
                    >
                      {d.label}
                    </span>
                    <Badge variant="outline">{FIELD_TYPE_LABEL[d.type]}</Badge>
                    {d.required && <ToneBadge tone="orange">Wajib</ToneBadge>}
                    {d.showInTable && <ToneBadge tone="blue">Kolom</ToneBadge>}
                    {d.filterable && <ToneBadge tone="purple">Filter</ToneBadge>}
                    {!d.isActive && <ToneBadge tone="red">Nonaktif</ToneBadge>}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    <code>{d.key}</code>
                    {conditionText(d, list) && ` · ${conditionText(d, list)}`}
                  </p>
                </div>
                {can("update", "CustomField") && (
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Naikkan"
                      disabled={pending || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Turunkan"
                      disabled={pending || i === list.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraft(toDraft(d));
                        setOpen(true);
                      }}
                    >
                      <Pencil /> Ubah
                    </Button>
                    {can("delete", "CustomField") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Hapus field “${d.label}”? Nilai yang tersimpan tidak lagi ditampilkan.`,
                            )
                          )
                            return;
                          start(async () => {
                            const res = await deleteCustomField({ id: d.id! });
                            if (!res.ok) toast.error(res.error);
                            else toast.success("Field dihapus");
                          });
                        }}
                      >
                        <Trash2 /> Hapus
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {open && (
        <FieldDialog
          entity={entity}
          open={open}
          onOpenChange={setOpen}
          draft={draft}
          setDraft={setDraft}
          siblings={list}
          previousOptions={previousOptions}
        />
      )}
    </Card>
  );
}
