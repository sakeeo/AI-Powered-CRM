"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/server/actions";
import type { NotificationView } from "@/modules/notifications/server/queries";

/** Bell topbar: badge belum-dibaca + 8 notifikasi terbaru. Menyegarkan data tiap 60 detik. */
export function NotificationBell({ unread, items }: { unread: number; items: NotificationView[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifikasi, ${unread} belum dibaca`}
        >
          <Bell />
          {unread > 0 && (
            <span
              data-testid="unread-badge"
              className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifikasi
          {unread > 0 && (
            <button
              className="text-primary text-xs font-normal hover:underline"
              onClick={async () => {
                await markAllNotificationsRead({});
                router.refresh();
              }}
            >
              Tandai semua dibaca
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="text-muted-foreground px-2 py-3 text-xs">Belum ada notifikasi.</p>
        )}
        {items.map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="flex-col items-start gap-0.5"
            onSelect={async () => {
              if (!n.readAt) await markNotificationRead({ id: n.id });
              router.push(n.link ?? "/notifications");
              router.refresh();
            }}
          >
            <span className={n.readAt ? "text-muted-foreground text-sm" : "text-sm font-medium"}>
              {n.title}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {new Date(n.createdAt).toLocaleString("id-ID")}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications">Lihat semua</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
