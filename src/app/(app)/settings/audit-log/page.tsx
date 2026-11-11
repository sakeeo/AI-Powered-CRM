import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTenant } from "@/lib/context";
import { AuditTable } from "@/modules/audit/components/audit-table";
import { listAuditLogs } from "@/modules/audit/server/queries";
import { getOrganization } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Audit Log" };

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const ctx = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [data, org] = await Promise.all([
    listAuditLogs(ctx, { page, entityType: sp.type }),
    getOrganization(ctx),
  ]);
  return <AuditTable data={data} page={page} entityType={sp.type} timeZone={org.timezone} />;
}

export default function Page(props: PageProps<"/settings/audit-log">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={props.searchParams as Promise<{ page?: string; type?: string }>} />
    </Suspense>
  );
}
