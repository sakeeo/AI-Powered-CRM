import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { AutomationPanel } from "@/modules/automation/components/automation-panel";
import { listRules, listRuns } from "@/modules/automation/server/queries";
import { listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Automation" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Automation")) return <Forbidden what="automation" />;
  const [rules, runs, owners] = await Promise.all([
    listRules(ctx),
    listRuns(ctx),
    listOwnerOptions(ctx),
  ]);
  return <AutomationPanel rules={rules} runs={runs} owners={owners} />;
}
