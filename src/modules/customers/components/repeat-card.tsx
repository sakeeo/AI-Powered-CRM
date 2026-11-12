"use client";

import { CalendarPlus } from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { RowAction } from "@/components/shared/row-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REPEAT_LABEL, type RepeatStatus } from "@/modules/customers/repeat";
import { createRepeatFollowUp } from "@/modules/customers/server/repeat-actions";
import type { RepeatOpportunity } from "@/modules/customers/server/repeat";

const TONE: Record<RepeatStatus, "red" | "orange" | "purple" | "blue" | "green"> = {
  overdue: "red",
  soon: "orange",
  one_time_stale: "purple",
  scheduled: "blue",
  one_time_recent: "green",
};
const day = (d: Date) => new Date(d).toLocaleDateString("id-ID");

/** Peluang repeat purchase dari pola pembelian (deterministik): perkiraan beli ulang & pembeli satu kali yang lama. */
export function RepeatCard({
  items,
  canCreate,
}: {
  items: RepeatOpportunity[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Peluang repeat purchase</CardTitle>
          <CardDescription>
            Customer tanpa deal terbuka yang kemungkinan perlu di-follow-up, dihitung dari interval
            antar pembelian (perkiraan, bukan jaminan).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border" data-testid="repeat-list">
          {items.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="text-sm font-medium hover:underline"
                    href={`/customers/${r.type}/${r.id}`}
                  >
                    {r.name}
                  </Link>
                  <ToneBadge tone={TONE[r.status]}>{REPEAT_LABEL[r.status]}</ToneBadge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.purchases}× beli · terakhir {day(r.lastAt)}
                  {r.avgIntervalDays && r.predictedNextAt
                    ? ` · rata-rata tiap ${r.avgIntervalDays} hari · perkiraan ${day(r.predictedNextAt)}`
                    : ` · ${r.daysLate} hari sejak pembelian`}
                </p>
              </div>
              {canCreate && (
                <RowAction
                  icon={CalendarPlus}
                  label="Buat follow-up"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await createRepeatFollowUp({ type: r.type, id: r.id });
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Task follow-up dibuat");
                        router.refresh();
                      }
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
