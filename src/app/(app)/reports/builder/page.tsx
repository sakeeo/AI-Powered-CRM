import type { Metadata } from "next";
import Link from "next/link";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/context";
import { ReportBuilder } from "@/modules/reports/components/report-builder";
import { builderOptions, listSavedReports } from "@/modules/reports/server/saved-queries";

export const metadata: Metadata = { title: "Report Builder" };

export default async function Page() {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Report")) return <Forbidden what="laporan" />;
  const [saved, options] = await Promise.all([listSavedReports(ctx), builderOptions(ctx)]);
  return (
    <div className="space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href="/reports">← Laporan standar</Link>
      </Button>
      <ReportBuilder
        saved={saved}
        options={options}
        canShareOrg={["owner", "admin", "sales_manager"].includes(ctx.role)}
      />
    </div>
  );
}
