import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { InsightsPanel } from "@/modules/insights/components/insights-panel";

export const metadata: Metadata = { title: "Tanya CRM" };

export default async function Page() {
  await requireTenant();
  return <InsightsPanel />;
}
