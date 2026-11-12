"use client";

import { useEffect, useState } from "react";
import { UrlFilterSelect, useUrlState } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import type { ListCustomization } from "@/modules/customization/components/customization-columns";
import { CF_PARAM_PREFIX, TAG_PARAM } from "@/modules/customization/constants";
import type { FieldDef } from "@/modules/customization/custom-fields";

function UrlTextFilter({ def }: { def: FieldDef }) {
  const param = `${CF_PARAM_PREFIX}${def.key}`;
  const { sp, set } = useUrlState();
  const current = sp.get(param) ?? "";
  const [value, setValue] = useState(current);
  // Sinkronkan saat URL berubah dari luar (mis. memilih saved view) tanpa efek.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setValue(current);
  }
  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => set({ [param]: value || undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      aria-label={`Filter ${def.label}`}
      placeholder={def.label}
      type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
      className="h-8 w-36 text-[13px]"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

/** Filter tag + custom field `filterable` untuk toolbar tabel (nilai ditulis ke URL). */
export function CustomizationFilters({ custom }: { custom?: ListCustomization }) {
  if (!custom) return null;
  const filterable = custom.defs.filter((d) => d.filterable);
  return (
    <>
      {custom.allTags.length > 0 && (
        <UrlFilterSelect
          param={TAG_PARAM}
          label="Filter tag"
          allLabel="Semua tag"
          options={custom.allTags.map((t) => ({ value: t.id, label: t.name }))}
        />
      )}
      {filterable.map((d) =>
        d.type === "select" || d.type === "multiselect" ? (
          <UrlFilterSelect
            key={d.key}
            param={`${CF_PARAM_PREFIX}${d.key}`}
            label={`Filter ${d.label}`}
            allLabel={d.label}
            options={d.options}
          />
        ) : d.type === "boolean" ? (
          <UrlFilterSelect
            key={d.key}
            param={`${CF_PARAM_PREFIX}${d.key}`}
            label={`Filter ${d.label}`}
            allLabel={d.label}
            options={[
              { value: "true", label: "Ya" },
              { value: "false", label: "Tidak" },
            ]}
          />
        ) : (
          <UrlTextFilter key={d.key} def={d} />
        ),
      )}
    </>
  );
}
