import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageActions } from "@/components/shared/page-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { ListTodo } from "lucide-react";
import { ACTIVITY_BUCKETS, type ActivityBucket } from "@/modules/activities/constants";
import { ActivityItem } from "@/modules/activities/components/activity-item";
import { countOverdue, listActivities } from "@/modules/activities/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Activities & Tasks" };

const LABEL: Record<ActivityBucket, string> = {
  overdue: "Terlambat",
  upcoming: "Mendatang",
  done: "Selesai",
};

export default async function Page(props: PageProps<"/activities">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const raw = pickParam(sp, "bucket");
  const bucket = (ACTIVITY_BUCKETS as readonly string[]).includes(raw ?? "")
    ? (raw as ActivityBucket)
    : "upcoming";
  const mine = pickParam(sp, "mine") === "1";
  const [items, overdue, owners, org] = await Promise.all([
    listActivities(ctx, { bucket, mine }),
    countOverdue(ctx),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  const names = new Map(owners.map((o) => [o.userId, o.name]));
  const href = (b: ActivityBucket, m = mine) => `/activities?bucket=${b}${m ? "&mine=1" : ""}`;
  return (
    <div className="space-y-4">
      <PageActions>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kelompok aktivitas">
          {ACTIVITY_BUCKETS.map((b) => (
            <Button key={b} asChild size="sm" variant={bucket === b ? "default" : "outline"}>
              <Link href={href(b)} role="tab" aria-selected={bucket === b}>
                {LABEL[b]}
                {b === "overdue" && overdue > 0 ? ` (${overdue})` : ""}
              </Link>
            </Button>
          ))}
        </div>
        <Button asChild size="sm" variant={mine ? "default" : "outline"}>
          <Link href={href(bucket, !mine)}>Milik saya</Link>
        </Button>
      </PageActions>
      <Card className="p-card">
        {items.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={`Tidak ada aktivitas ${LABEL[bucket].toLowerCase()}`}
            description="Buat task atau catat aktivitas dari halaman detail lead, contact, company, atau deal."
          />
        ) : (
          <ul className="divide-border divide-y" data-testid="activity-list">
            {items.map((a) => (
              <ActivityItem
                key={a.id}
                a={a}
                showLinks
                timezone={org.timezone}
                ownerName={a.ownerId ? names.get(a.ownerId) : undefined}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
