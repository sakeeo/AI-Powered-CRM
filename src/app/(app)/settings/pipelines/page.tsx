import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { PipelineConfig } from "@/modules/deals/components/pipeline-config";
import { getDefaultPipeline } from "@/modules/deals/server/queries";

export const metadata: Metadata = { title: "Pipeline" };

export default async function Page() {
  const ctx = await requireTenant();
  const p = await getDefaultPipeline(ctx);
  return (
    <PipelineConfig
      pipeline={{
        id: p.id,
        name: p.name,
        stages: p.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability })),
      }}
    />
  );
}
