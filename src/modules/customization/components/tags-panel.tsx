"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { SelectField } from "@/components/shared/select-field";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/modules/customization/components/tag-chip";
import { TAG_COLORS, type TagColor } from "@/modules/customization/constants";
import { createTag, deleteTag, updateTag } from "@/modules/customization/server/actions";

export type TagRow = { id: string; name: string; color: TagColor; usage: number };

const COLOR_LABEL: Record<TagColor, string> = {
  blue: "Biru",
  green: "Hijau",
  orange: "Oranye",
  red: "Merah",
  purple: "Ungu",
};
const colorOptions = TAG_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] }));

function Row({ tag }: { tag: TagRow }) {
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState<string>(tag.color);
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      {editing ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateTag({ id: tag.id, name, color: color as TagColor });
              if (!res.ok) toast.error(res.fieldErrors?.name ?? res.error);
              else {
                toast.success("Tag diperbarui");
                setEditing(false);
              }
            });
          }}
        >
          <Input
            aria-label="Nama tag"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-44"
          />
          <div className="w-28">
            <SelectField value={color} onChange={setColor} options={colorOptions} />
          </div>
          <RowAction icon={Check} label="Simpan" type="submit" disabled={pending} />
          <RowAction
            icon={X}
            label="Batal"
            type="button"
            variant="outline"
            onClick={() => setEditing(false)}
          />
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <TagChip tag={tag} />
          <span className="text-muted-foreground text-xs tabular-nums">{tag.usage} data</span>
        </div>
      )}
      {!editing && (
        <div className="flex gap-2">
          {can("update", "Tag") && (
            <RowAction
              icon={Pencil}
              label="Ubah"
              variant="outline"
              onClick={() => setEditing(true)}
            />
          )}
          {can("delete", "Tag") && (
            <RowAction
              icon={Trash2}
              label="Hapus"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (
                  tag.usage > 0 &&
                  !window.confirm(`Tag “${tag.name}” dipakai ${tag.usage} data. Hapus tetap?`)
                )
                  return;
                start(async () => {
                  const res = await deleteTag({ id: tag.id });
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Tag dihapus");
                });
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

export function TagsPanel({ tags }: { tags: TagRow[] }) {
  const can = useCan();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Label untuk mengelompokkan lead, contact, company, dan deal. Dapat dipakai sebagai
            filter di tabel.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {can("create", "Tag") && (
          <form
            className="mb-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createTag({ name, color: color as TagColor });
                if (!res.ok) toast.error(res.fieldErrors?.name ?? res.error);
                else {
                  toast.success("Tag ditambahkan");
                  setName("");
                }
              });
            }}
          >
            <Input
              aria-label="Nama tag baru"
              placeholder="Tag baru"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="w-40"
              required
            />
            <div className="w-28">
              <SelectField value={color} onChange={setColor} options={colorOptions} />
            </div>
            <Button type="submit" disabled={pending}>
              Tambah
            </Button>
          </form>
        )}
        {tags.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Belum ada tag.</p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {tags.map((t) => (
              <Row key={t.id} tag={t} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
