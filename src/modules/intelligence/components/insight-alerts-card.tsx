"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ANOMALY_LABEL, type AnomalyKind } from "@/modules/intelligence/anomalies";
import {
  dismissInsightAlert,
  scanInsightsNow,
} from "@/modules/intelligence/server/insight-actions";

export type AlertRow = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  detail: string;
  subjectType: string | null;
  subjectId: string | null;
  detectedAt: string;
};

/** Anomali & insight otomatis (informasi saja — tidak ada tindakan otomatis). */
export function InsightAlertsCard({ alerts, canScan }: { alerts: AlertRow[]; canScan: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card data-testid="insight-alerts">
      <CardHeader>
        <div>
          <CardTitle>Anomali & insight otomatis</CardTitle>
          <CardDescription>
            Dipindai terjadwal tiap 6 jam: penurunan aktivitas customer VIP, win rate, dan aliran
            lead baru. Hanya pemberitahuan — tidak ada tindakan otomatis.
          </CardDescription>
        </div>
        {canScan && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await scanInsightsNow({});
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(`${res.data.created} anomali baru`);
                  router.refresh();
                }
              })
            }
          >
            Pindai sekarang
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-muted-foreground text-sm" data-testid="no-alerts">
            Tidak ada anomali terbuka.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.subjectType && a.subjectId ? (
                      <Link
                        className="text-sm font-medium hover:underline"
                        href={`/customers/${a.subjectType}/${a.subjectId}`}
                      >
                        {a.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{a.title}</span>
                    )}
                    <ToneBadge tone={a.severity === "high" ? "red" : "orange"}>
                      {ANOMALY_LABEL[a.kind as AnomalyKind] ?? a.kind}
                    </ToneBadge>
                  </div>
                  <p className="text-muted-foreground text-xs">{a.detail}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await dismissInsightAlert({ id: a.id });
                      if (!res.ok) toast.error(res.error);
                      else router.refresh();
                    })
                  }
                >
                  Abaikan
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
