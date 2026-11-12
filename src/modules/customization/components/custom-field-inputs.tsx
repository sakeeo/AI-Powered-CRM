"use client";

import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  visibleFields,
  type CustomValues,
  type FieldDef,
} from "@/modules/customization/custom-fields";

/**
 * Input untuk semua custom field entitas. Field yang disembunyikan kondisi tidak dirender,
 * dan nilainya dibuang di server saat disimpan.
 */
export function CustomFieldInputs({
  defs,
  values,
  onChange,
  idPrefix = "cf",
}: {
  defs: FieldDef[];
  values: CustomValues;
  onChange: (next: CustomValues) => void;
  idPrefix?: string;
}) {
  const shown = visibleFields(defs, values);
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });
  if (!shown.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {shown.map((d) => {
        const id = `${idPrefix}-${d.key}`;
        const label = d.required ? `${d.label} *` : d.label;
        const v = values[d.key];
        switch (d.type) {
          case "textarea":
            return (
              <div key={d.key} className="sm:col-span-2">
                <FormField id={id} label={label}>
                  <Textarea
                    id={id}
                    rows={3}
                    value={String(v ?? "")}
                    onChange={(e) => set(d.key, e.target.value)}
                  />
                </FormField>
              </div>
            );
          case "boolean":
            return (
              <div key={d.key} className="flex items-center gap-2 pt-6">
                <Checkbox
                  id={id}
                  checked={v === true}
                  onCheckedChange={(c) => set(d.key, c === true)}
                />
                <Label htmlFor={id}>{d.label}</Label>
              </div>
            );
          case "select":
            return (
              <FormField key={d.key} id={id} label={label}>
                <SelectField
                  id={id}
                  value={typeof v === "string" ? v : ""}
                  onChange={(x) => set(d.key, x)}
                  noneLabel="Belum dipilih"
                  options={d.options}
                />
              </FormField>
            );
          case "multiselect": {
            const cur = Array.isArray(v) ? (v as string[]) : [];
            return (
              <fieldset key={d.key} className="space-y-1.5 sm:col-span-2">
                <legend className="text-sm leading-none font-medium">{label}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                  {d.options.map((o) => (
                    <div key={o.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-${o.value}`}
                        checked={cur.includes(o.value)}
                        onCheckedChange={(c) =>
                          set(
                            d.key,
                            c === true ? [...cur, o.value] : cur.filter((x) => x !== o.value),
                          )
                        }
                      />
                      <Label htmlFor={`${id}-${o.value}`}>{o.label}</Label>
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          }
          default:
            return (
              <FormField key={d.key} id={id} label={label}>
                <Input
                  id={id}
                  type={
                    d.type === "number"
                      ? "number"
                      : d.type === "date"
                        ? "date"
                        : d.type === "url"
                          ? "url"
                          : "text"
                  }
                  step={d.type === "number" ? "any" : undefined}
                  value={String(v ?? "")}
                  onChange={(e) => set(d.key, e.target.value)}
                />
              </FormField>
            );
        }
      })}
    </div>
  );
}
