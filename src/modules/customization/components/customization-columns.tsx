"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { TagList } from "@/modules/customization/components/tag-chip";
import type { PickerTag } from "@/modules/customization/components/tag-picker";
import type { CustomEntity } from "@/modules/customization/constants";
import {
  formatCustomValue,
  readValues,
  type FieldDef,
} from "@/modules/customization/custom-fields";
import type { TagDto } from "@/modules/customization/server/queries";

/** Data kustomisasi untuk tabel daftar (serializable: dikirim dari Server Component). */
export type ListCustomization = {
  entity: CustomEntity;
  defs: FieldDef[];
  allTags: PickerTag[];
  rowTags: Record<string, TagDto[]>;
};

/** Kolom tambahan tabel: Tag + custom field ber-flag `showInTable`. */
export function useCustomColumns<T extends { id: string }>(
  custom: ListCustomization | undefined,
): ColumnDef<T, unknown>[] {
  return useMemo(() => {
    if (!custom) return [];
    const cols: ColumnDef<T, unknown>[] = [];
    if (custom.allTags.length) {
      cols.push({
        header: "Tag",
        id: "tags",
        cell: (c) => <TagList tags={custom.rowTags[c.row.original.id]} />,
      });
    }
    for (const d of custom.defs.filter((x) => x.showInTable)) {
      cols.push({
        header: d.label,
        id: `cf_${d.key}`,
        meta: d.type === "number" ? { className: "text-right tabular-nums" } : undefined,
        cell: (c) => {
          const v = readValues((c.row.original as { customFields?: unknown }).customFields)[d.key];
          return formatCustomValue(d, v) || "—";
        },
      });
    }
    return cols;
  }, [custom]);
}
