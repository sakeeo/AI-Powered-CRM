"use client";

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  ListTodo,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { formatInTz } from "@/lib/timezone";
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TYPE_LABEL,
  type ActivityStatus,
  type ActivityType,
} from "@/modules/activities/constants";
import { deleteActivity, setActivityStatus } from "@/modules/activities/server/actions";

const ICON = { task: ListTodo, call: Phone, meeting: Users, email: Mail, note: FileText, whatsapp: MessageCircle } as const;

export type ActivityView = {
  id: string;
  type: string;
  subject: string;
  /** HTML yang sudah disanitasi di server saat disimpan. */
  body: string | null;
  status: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  ownerId: string | null;
  lead: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
};

export function ActivityItem({
  a,
  timezone,
  ownerName,
  showLinks,
}: {
  a: ActivityView;
  timezone: string;
  ownerName?: string;
  showLinks?: boolean;
}) {
  const can = useCan();
  const router = useRouter();
  const [pending, start] = useTransition();
  const Icon = ICON[a.type as ActivityType] ?? FileText;
  const status = a.status as ActivityStatus;
  const overdue = status === "open" && a.dueAt && new Date(a.dueAt) < new Date();
  const canEdit = can("update", "Activity", a);

  const run = (fn: () => ReturnType<typeof setActivityStatus>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  const links = [
    a.lead && { href: `/leads/${a.lead.id}`, label: a.lead.name },
    a.contact && { href: `/contacts/${a.contact.id}`, label: a.contact.name },
    a.company && { href: `/companies/${a.company.id}`, label: a.company.name },
    a.deal && { href: `/deals/${a.deal.id}`, label: a.deal.title },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <li className="flex gap-3 py-3" data-testid="activity-item">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${status === "cancelled" ? "line-through" : ""}`}>
            {a.subject}
          </span>
          <ToneBadge tone="blue">{ACTIVITY_TYPE_LABEL[a.type as ActivityType] ?? a.type}</ToneBadge>
          <ToneBadge
            tone={
              status === "done"
                ? "green"
                : status === "cancelled"
                  ? "orange"
                  : overdue
                    ? "red"
                    : "blue"
            }
          >
            {overdue ? "Terlambat" : ACTIVITY_STATUS_LABEL[status]}
          </ToneBadge>
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
          {a.dueAt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarClock className="size-3" /> {formatInTz(a.dueAt, timezone)}
            </span>
          )}
          {a.completedAt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="size-3" /> {formatInTz(a.completedAt, timezone)}
            </span>
          )}
          {ownerName && <span>{ownerName}</span>}
          <span className="tabular-nums">dibuat {formatInTz(a.createdAt, timezone)}</span>
        </p>
        {a.body && (
          <div
            className="text-label [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: a.body }}
          />
        )}
        {showLinks && links.length > 0 && (
          <p className="text-xs">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-primary mr-3 hover:underline">
                {l.label}
              </Link>
            ))}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-start gap-1">
          {status === "open" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setActivityStatus({ id: a.id, status: "done" }))}
              >
                Selesai
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setActivityStatus({ id: a.id, status: "cancelled" }))}
              >
                Batal
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => setActivityStatus({ id: a.id, status: "open" }))}
            >
              Buka lagi
            </Button>
          )}
          {can("delete", "Activity", a) && (
            <Button
              variant="destructive"
              aria-label={`Hapus ${a.subject}`}
              disabled={pending}
              onClick={() => run(() => deleteActivity({ id: a.id }) as never)}
            >
              <Trash2 /> Hapus
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
