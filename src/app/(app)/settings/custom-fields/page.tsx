import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { CustomFieldsPanel } from "@/modules/customization/components/custom-fields-panel";
import { CUSTOM_ENTITIES, type CustomEntity } from "@/modules/customization/constants";
import type { FieldDef } from "@/modules/customization/custom-fields";
import { listFieldDefs } from "@/modules/customization/server/queries";

export const metadata: Metadata = { title: "Custom Fields" };

export default async function Page() {
  const ctx = await requireTenant();
  const entries = await Promise.all(
    CUSTOM_ENTITIES.map(async (e) => [e, await listFieldDefs(ctx, e)] as const),
  );
  return (
    <CustomFieldsPanel fields={Object.fromEntries(entries) as Record<CustomEntity, FieldDef[]>} />
  );
}
