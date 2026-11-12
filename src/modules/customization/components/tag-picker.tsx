"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/modules/customization/components/tag-chip";
import type { TagColor } from "@/modules/customization/constants";
import { createTag } from "@/modules/customization/server/actions";

export type PickerTag = { id: string; name: string; color: TagColor };

/** Pilih beberapa tag untuk satu record; tag baru dapat dibuat langsung (bila diizinkan). */
export function TagPicker({
  tags,
  value,
  onChange,
  canCreate,
}: {
  tags: PickerTag[];
  value: string[];
  onChange: (ids: string[]) => void;
  canCreate: boolean;
}) {
  const [all, setAll] = useState(tags);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const byId = new Map(all.map((t) => [t.id, t]));
  const available = all.filter((t) => !value.includes(t.id));

  function create() {
    const n = name.trim();
    if (!n) return;
    start(async () => {
      const res = await createTag({ name: n, color: "blue" });
      if (!res.ok) {
        toast.error(res.fieldErrors?.name ?? res.error);
        return;
      }
      const tag = { id: res.data.id, name: res.data.name, color: res.data.color };
      setAll((cur) => [...cur, tag]);
      onChange([...value, tag.id]);
      setName("");
    });
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tag terpilih">
          {value.map((id) => {
            const t = byId.get(id);
            if (!t) return null;
            return (
              <li key={id} className="inline-flex items-center gap-1">
                <TagChip tag={t} />
                <button
                  type="button"
                  aria-label={`Hapus tag ${t.name}`}
                  className="text-muted-foreground hover:text-foreground rounded p-0.5"
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {available.length > 0 && (
          <div className="w-44">
            <SelectField
              id="tag-add"
              value=""
              onChange={(id) => id && onChange([...value, id])}
              placeholder="Tambah tag…"
              options={available.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
        )}
        {canCreate && (
          <div className="flex gap-1.5">
            <Input
              aria-label="Nama tag baru"
              placeholder="Tag baru"
              value={name}
              maxLength={40}
              className="h-9 w-32"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={pending}
              onClick={create}
              aria-label="Buat tag"
            >
              <Plus />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
