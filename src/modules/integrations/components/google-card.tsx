"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  disconnectGoogle,
  syncGoogleNow,
  updateGoogleOptions,
} from "@/modules/integrations/server/google-actions";

export type GoogleView = {
  configured: boolean;
  integration: {
    googleEmail: string;
    syncCalendar: boolean;
    syncEmail: boolean;
    hasGmailScope: boolean;
    status: string;
    lastError: string | null;
    lastSyncAt: Date | null;
  } | null;
};

/** Koneksi Google milik pengguna sendiri: Calendar dua arah + Gmail read-only. */
export function GoogleCard({ view }: { view: GoogleView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [withEmail, setWithEmail] = useState(false);
  const i = view.integration;

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div>
          <CardTitle>Google Calendar & Gmail</CardTitle>
          <CardDescription>
            Sinkronkan task/meeting/call berjadwal Anda ke Google Calendar (dua arah) dan catat
            email dengan contact CRM ke timeline (read-only; hanya subjek dan cuplikan). Koneksi ini
            milik Anda pribadi.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!view.configured ? (
          <p className="text-muted-foreground text-sm" data-testid="google-unconfigured">
            Server belum dikonfigurasi untuk Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
            Hubungi administrator.
          </p>
        ) : !i ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="g-email"
                checked={withEmail}
                onCheckedChange={(c) => setWithEmail(c === true)}
              />
              <Label htmlFor="g-email">
                Sertakan izin baca Gmail (catat email contact ke timeline)
              </Label>
            </div>
            <Button asChild>
              <a href={`/api/integrations/google/connect${withEmail ? "?email=1" : ""}`}>
                Hubungkan Google
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{i.googleEmail}</span>
              <ToneBadge
                tone={i.status === "active" ? "green" : i.status === "revoked" ? "red" : "orange"}
              >
                {i.status === "active"
                  ? "Terhubung"
                  : i.status === "revoked"
                    ? "Akses dicabut"
                    : "Bermasalah"}
              </ToneBadge>
              {i.lastSyncAt && (
                <span className="text-muted-foreground text-xs">
                  Sinkron terakhir {new Date(i.lastSyncAt).toLocaleString("id-ID")}
                </span>
              )}
            </div>
            {i.lastError && <p className="text-tone-red-ink text-xs">{i.lastError}</p>}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="g-cal"
                  checked={i.syncCalendar}
                  disabled={pending}
                  onCheckedChange={(c) =>
                    start(async () => {
                      const r = await updateGoogleOptions({
                        syncCalendar: c === true,
                        syncEmail: i.syncEmail,
                      });
                      if (!r.ok) toast.error(r.error);
                      router.refresh();
                    })
                  }
                />
                <Label htmlFor="g-cal">Sinkron Calendar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="g-mail"
                  checked={i.syncEmail}
                  disabled={pending || !i.hasGmailScope}
                  onCheckedChange={(c) =>
                    start(async () => {
                      const r = await updateGoogleOptions({
                        syncCalendar: i.syncCalendar,
                        syncEmail: c === true,
                      });
                      if (!r.ok) toast.error(r.error);
                      router.refresh();
                    })
                  }
                />
                <Label htmlFor="g-mail">
                  Catat email ke timeline{" "}
                  {!i.hasGmailScope && "(perlu menghubungkan ulang dengan izin Gmail)"}
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await syncGoogleNow({});
                    if (!r.ok) toast.error(r.error);
                    else
                      toast.success(
                        `Sinkron selesai: ${r.data.changed} perubahan kalender, ${r.data.logged} email dicatat`,
                      );
                    router.refresh();
                  })
                }
              >
                Sinkronkan sekarang
              </Button>
              <Button variant="outline" asChild>
                <a href={`/api/integrations/google/connect${i.hasGmailScope ? "?email=1" : ""}`}>
                  Hubungkan ulang
                </a>
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await disconnectGoogle({});
                    if (!r.ok) toast.error(r.error);
                    else toast.success("Google diputus");
                    router.refresh();
                  })
                }
              >
                Putuskan
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
