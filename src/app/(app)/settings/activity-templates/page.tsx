import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { TemplatesPanel } from "@/modules/activities/components/templates-panel";
import { listActivityTemplates } from "@/modules/activities/server/queries";

export const metadata: Metadata = { title: "Template Aktivitas" };

export default async function Page() {
  const ctx = await requireTenant();
  return (
    <TemplatesPanel
      templates={await listActivityTemplates(ctx, { all: true })}
      canManage={["owner", "admin", "sales_manager"].includes(ctx.role)}
    />
  );
}
