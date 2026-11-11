import type { Metadata } from "next";
import { PageActions } from "@/components/shared/page-actions";
import { UrlFilterSelect } from "@/components/shared/data-table";
import { requireTenant } from "@/lib/context";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { toLocalInput } from "@/lib/timezone";
import { CalendarView, type CalendarEvent } from "@/modules/activities/components/calendar-view";
import { calendarRange, listCalendarActivities } from "@/modules/activities/server/queries";
import { getOrganization, listOwnerOptions } from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Calendar" };

export default async function Page(props: PageProps<"/calendar">) {
  const ctx = await requireTenant();
  const sp = (await props.searchParams) as SearchParams;
  const { from, to } = calendarRange(pickParam(sp, "from"), pickParam(sp, "to"));
  const [org, owners, rows] = await Promise.all([
    getOrganization(ctx),
    listOwnerOptions(ctx),
    // Margin ±1 hari untuk perbedaan zona waktu pada batas rentang.
    listCalendarActivities(
      ctx,
      { from: new Date(from.getTime() - 86_400_000), to: new Date(to.getTime() + 86_400_000) },
      pickParam(sp, "owner"),
    ),
  ]);
  const events: CalendarEvent[] = rows.map((a) => ({
    id: a.id,
    title: a.subject,
    start: toLocalInput(a.dueAt!, org.timezone),
    done: a.status === "done",
    type: a.type,
    href: a.lead
      ? `/leads/${a.lead.id}`
      : a.deal
        ? `/deals/${a.deal.id}`
        : a.contact
          ? `/contacts/${a.contact.id}`
          : a.company
            ? `/companies/${a.company.id}`
            : "/activities",
  }));
  return (
    <div className="space-y-4">
      <PageActions>
        <UrlFilterSelect
          param="owner"
          label="Filter user"
          allLabel="Semua user"
          options={owners.map((o) => ({ value: o.userId, label: o.name }))}
        />
      </PageActions>
      <CalendarView events={events} />
    </div>
  );
}
