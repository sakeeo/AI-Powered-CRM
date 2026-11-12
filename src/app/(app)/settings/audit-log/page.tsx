import type { Metadata } from "next";
import { Suspense } from "react";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/list-params";
import { AuditTable } from "@/modules/audit/components/audit-table";
import { listAuditLogs } from "@/modules/audit/server/queries";
import { getOrganization } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Audit Log" };

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; pageSize?: string }>;
}) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "AuditLog")) return <Forbidden what="audit log" />;
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = Number(sp.pageSize);
  const size = PAGE_SIZE_OPTIONS.includes(pageSize as 10) ? pageSize : DEFAULT_PAGE_SIZE;
  const [data, org] = await Promise.all([
    listAuditLogs(ctx, { page, pageSize: size, entityType: sp.type }),
    getOrganization(ctx),
  ]);
  return (
    <AuditTable
      data={data}
      page={page}
      pageSize={size}
      entityType={sp.type}
      timeZone={org.timezone}
    />
  );
}

export default function Page(props: PageProps<"/settings/audit-log">) {
  return (
    <Suspense fallback={null}>
      <Content
        searchParams={
          props.searchParams as Promise<{ page?: string; type?: string; pageSize?: string }>
        }
      />
    </Suspense>
  );
}
