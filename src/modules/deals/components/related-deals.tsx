import Link from "next/link";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { DEAL_STATUS_LABEL, DEAL_STATUS_TONE, type DealStatus } from "@/modules/deals/constants";
import type { listRelatedDeals } from "@/modules/deals/server/queries";

/** Kartu "Related deals" di halaman contact/company (CONT-08). */
export function RelatedDeals({ deals }: { deals: Awaited<ReturnType<typeof listRelatedDeals>> }) {
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>Related deals ({deals.length})</CardTitle>
        <CardDescription>Deal yang terhubung dan boleh Anda lihat.</CardDescription>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-muted-foreground text-label">Belum ada deal.</p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {deals.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div>
                  <Link
                    href={`/deals/${d.id}`}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    {d.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">{d.stage.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">{formatMoney(d.value, d.currency)}</span>
                  <ToneBadge tone={DEAL_STATUS_TONE[d.status as DealStatus] ?? "blue"}>
                    {DEAL_STATUS_LABEL[d.status as DealStatus] ?? d.status}
                  </ToneBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
