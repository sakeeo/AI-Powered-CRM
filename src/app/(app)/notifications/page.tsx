import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenant } from "@/lib/context";
import { PreferencesForm } from "@/modules/notifications/components/preferences-form";
import { getPreferences, listMyNotifications } from "@/modules/notifications/server/queries";
import { Bell } from "lucide-react";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function Page() {
  const ctx = await requireTenant();
  const [items, prefs] = await Promise.all([listMyNotifications(ctx, 100), getPreferences(ctx)]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Belum ada notifikasi"
              description="Reminder task akan muncul di sini."
            />
          ) : (
            <ul className="divide-border divide-y" data-testid="inbox">
              {items.map((n) => (
                <li key={n.id} className="py-2.5">
                  <Link
                    href={n.link ?? "/notifications"}
                    className={`text-sm hover:underline ${n.readAt ? "text-muted-foreground" : "font-medium"}`}
                  >
                    {n.title}
                  </Link>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {n.createdAt.toLocaleString("id-ID")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preferensi</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm initial={prefs} />
        </CardContent>
      </Card>
    </div>
  );
}
