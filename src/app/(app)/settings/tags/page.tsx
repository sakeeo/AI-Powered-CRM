import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { TagsPanel } from "@/modules/customization/components/tags-panel";
import { listTags } from "@/modules/customization/server/queries";

export const metadata: Metadata = { title: "Tags" };

export default async function Page() {
  const ctx = await requireTenant();
  return <TagsPanel tags={await listTags(ctx)} />;
}
