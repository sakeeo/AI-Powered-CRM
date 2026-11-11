"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setNotificationPreferences } from "@/modules/notifications/server/actions";

/** Preferensi dasar: notifikasi in-app dan email reminder. Tersimpan saat diubah. */
export function PreferencesForm({ initial }: { initial: { inApp: boolean; email: boolean } }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();
  const change = (next: typeof prefs) => {
    setPrefs(next);
    start(async () => {
      const res = await setNotificationPreferences(next);
      if (!res.ok) toast.error(res.error);
      else toast.success("Preferensi disimpan");
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="pref-inapp"
          checked={prefs.inApp}
          disabled={pending}
          onCheckedChange={(v) => change({ ...prefs, inApp: v === true })}
        />
        <Label htmlFor="pref-inapp">Notifikasi di dalam aplikasi</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="pref-email"
          checked={prefs.email}
          disabled={pending}
          onCheckedChange={(v) => change({ ...prefs, email: v === true })}
        />
        <Label htmlFor="pref-email">Kirim reminder ke email</Label>
      </div>
    </div>
  );
}
