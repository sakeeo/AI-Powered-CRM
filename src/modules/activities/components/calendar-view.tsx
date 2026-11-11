"use client";

import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useRouter, useSearchParams } from "next/navigation";

export type CalendarEvent = {
  id: string;
  title: string;
  /** Waktu dinding zona organisasi (YYYY-MM-DDTHH:mm) agar tampil sama untuk semua perangkat. */
  start: string;
  done: boolean;
  href: string;
  type: string;
};

/** Kalender aktivitas (FullCalendar). Perubahan rentang tampilan memuat ulang data lewat query string. */
export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  function onDates(a: DatesSetArg) {
    const from = a.startStr.slice(0, 10);
    const to = a.endStr.slice(0, 10);
    if (sp.get("from") === from && sp.get("to") === to) return;
    const p = new URLSearchParams(sp.toString());
    p.set("from", from);
    p.set("to", to);
    router.replace(`/calendar?${p}`, { scroll: false });
  }

  return (
    <div
      className="bg-card rounded-xl border p-3 [&_.fc]:text-sm [&_.fc-button]:!text-xs"
      data-testid="calendar"
    >
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        locale="id"
        firstDay={1}
        height="auto"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek",
        }}
        buttonText={{ today: "Hari ini", month: "Bulan", week: "Minggu" }}
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          classNames: e.done ? ["opacity-60", "line-through"] : [],
          extendedProps: { href: e.href },
        }))}
        datesSet={onDates}
        eventClick={(a: EventClickArg) => {
          a.jsEvent.preventDefault();
          router.push(a.event.extendedProps.href as string);
        }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      />
    </div>
  );
}
