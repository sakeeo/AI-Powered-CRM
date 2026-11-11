import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantContext } from "@/lib/context";
import type { ActivityLink } from "@/modules/activities/constants";
import { ActivityComposer } from "@/modules/activities/components/activity-composer";
import { ActivityItem } from "@/modules/activities/components/activity-item";
import { listTimeline } from "@/modules/activities/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

/** Panel aktivitas untuk halaman detail lead/contact/company/deal: composer + timeline. */
export async function ActivitiesPanel({ ctx, link }: { ctx: TenantContext; link: ActivityLink }) {
  const [items, owners, org] = await Promise.all([
    listTimeline(ctx, link),
    listOwnerOptions(ctx),
    getOrganization(ctx),
  ]);
  const names = new Map(owners.map((o) => [o.userId, o.name]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ctx.ability.can("create", "Activity") && (
          <ActivityComposer
            link={link}
            owners={owners}
            canAssignOwner={ctx.role !== "sales_rep" && ctx.role !== "viewer"}
          />
        )}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs">Belum ada aktivitas.</p>
        ) : (
          <ul className="divide-border divide-y" data-testid="timeline">
            {items.map((a) => (
              <ActivityItem
                key={a.id}
                a={a}
                timezone={org.timezone}
                ownerName={a.ownerId ? names.get(a.ownerId) : undefined}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
