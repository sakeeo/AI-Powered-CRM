import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { LeadSourcesPanel } from "@/modules/leads/components/lead-sources-panel";
import { listLeadSources } from "@/modules/leads/server/queries";

export const metadata: Metadata = { title: "Lead Source" };

export default async function Page() {
  const ctx = await requireTenant();
  const sources = await listLeadSources(ctx);
  return (
    <LeadSourcesPanel
      sources={sources.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        isSystem: s.isSystem,
        leadCount: s._count.leads,
      }))}
    />
  );
}
