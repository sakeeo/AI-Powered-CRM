import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/shared/tone-badge";
import type { Dashboard } from "@/modules/dashboard/server/metrics";

type Group = {
  title: string;
  count: number;
  tone: "red" | "orange";
  items: { href: string; label: string }[];
  emptyText: string;
};

/** Panel Action Required (DASH-10): tiap kelompok menampilkan jumlah dan beberapa item teratas. */
export function ActionRequired({ data }: { data: Dashboard["actionRequired"] }) {
  const groups: Group[] = [
    {
      title: "Lead baru belum ditindaklanjuti",
      count: data.uncontactedLeads.count,
      tone: "orange",
      emptyText: "Semua lead baru sudah ditangani.",
      items: data.uncontactedLeads.items.map((l) => ({ href: `/leads/${l.id}`, label: l.name })),
    },
    {
      title: "Follow-up terlambat",
      count: data.overdueFollowUps.count,
      tone: "red",
      emptyText: "Tidak ada follow-up terlambat.",
      items: data.overdueFollowUps.items.map((a) => ({
        href: a.dealId
          ? `/deals/${a.dealId}`
          : a.leadId
            ? `/leads/${a.leadId}`
            : "/activities?bucket=overdue",
        label: a.subject,
      })),
    },
    {
      title: "Deal aktif tanpa next activity",
      count: data.dealsWithoutNextActivity.count,
      tone: "orange",
      emptyText: "Semua deal aktif punya aktivitas terjadwal.",
      items: data.dealsWithoutNextActivity.items.map((d) => ({
        href: `/deals/${d.id}`,
        label: d.title,
      })),
    },
    {
      title: "Quotation perlu tindak lanjut",
      count: data.quotationsToFollowUp.count,
      tone: "red",
      emptyText: "Tidak ada quotation yang mendekati kedaluwarsa.",
      items: data.quotationsToFollowUp.items.map((q) => ({
        href: `/quotations/${q.id}`,
        label: `${q.number} (s.d. ${q.validUntil})`,
      })),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4" aria-hidden /> Action Required
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2" data-testid="action-required">
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <ToneBadge tone={g.count ? g.tone : "green"}>
                <span data-testid="ar-count">{g.count}</span>
              </ToneBadge>
            </div>
            {g.items.length === 0 ? (
              <p className="text-muted-foreground text-xs">{g.emptyText}</p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {g.items.map((i) => (
                  <li key={i.href + i.label}>
                    <Link className="text-primary hover:underline" href={i.href}>
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
