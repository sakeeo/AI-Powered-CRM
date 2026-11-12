import { safeCell } from "@/lib/csv";
import type { TenantContext } from "@/lib/context";
import type { CustomEntity } from "@/modules/customization/constants";
import { formatCustomValue, readValues } from "@/modules/customization/custom-fields";
import { tagsForEntities, type ListingCustomization } from "@/modules/customization/server/queries";

/** Kolom tambahan export: Tag + semua custom field aktif (label sebagai header). Sel dinetralkan dari formula-injection. */
export async function customExportColumns(
  ctx: TenantContext,
  entity: CustomEntity,
  cust: ListingCustomization,
  rows: { id: string; customFields?: unknown }[],
) {
  const tagMap = await tagsForEntities(
    ctx,
    entity,
    rows.map((r) => r.id),
  );
  return {
    columns: ["Tag", ...cust.defs.map((d) => d.label)],
    cells: rows.map((r) => {
      const values = readValues(r.customFields);
      return [
        (tagMap[r.id] ?? []).map((t) => t.name).join("; "),
        ...cust.defs.map((d) => formatCustomValue(d, values[d.key])),
      ].map(safeCell);
    }),
  };
}
