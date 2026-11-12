"use client";

import { useEffect, useState } from "react";
import { useController, type Control, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomFieldInputs } from "@/modules/customization/components/custom-field-inputs";
import { TagPicker, type PickerTag } from "@/modules/customization/components/tag-picker";
import type { CustomEntity } from "@/modules/customization/constants";
import type { FieldDef } from "@/modules/customization/custom-fields";
import { getFormCustomization } from "@/modules/customization/server/actions";

type Loaded = { defs: FieldDef[]; tags: PickerTag[]; canCreateTag: boolean };

/**
 * Bagian form untuk tag + custom field (plan 2.1). Memuat definisi tenant saat form dibuka,
 * lalu mengikat `customFields` dan `tagIds` ke form React Hook Form pemanggil.
 * Tidak dirender bila organisasi belum punya field maupun tag dan pengguna tak boleh membuat tag.
 */
export function CustomizationSection({
  entity,
  control,
}: {
  entity: CustomEntity;
  /** `control` dari useForm milik form entitas (tipe generik berbeda per form). */
  control: unknown;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const cf = useController<FieldValues>({
    control: control as Control<FieldValues>,
    name: "customFields",
  });
  const tg = useController<FieldValues>({
    control: control as Control<FieldValues>,
    name: "tagIds",
  });

  useEffect(() => {
    let live = true;
    getFormCustomization({ entity }).then((res) => {
      if (live && res.ok) setData(res.data as Loaded);
    });
    return () => {
      live = false;
    };
  }, [entity]);

  if (!data) return <Skeleton className="h-10 w-full" />;
  const showTags = data.tags.length > 0 || data.canCreateTag;
  if (!showTags && data.defs.length === 0) return null;

  return (
    <div className="space-y-4">
      {showTags && (
        <div className="space-y-1.5">
          <Label>Tag</Label>
          <TagPicker
            tags={data.tags}
            canCreate={data.canCreateTag}
            value={(tg.field.value as string[] | undefined) ?? []}
            onChange={tg.field.onChange}
          />
        </div>
      )}
      <CustomFieldInputs
        defs={data.defs}
        idPrefix={`cf-${entity}`}
        values={(cf.field.value as Record<string, unknown> | undefined) ?? {}}
        onChange={cf.field.onChange}
      />
    </div>
  );
}
