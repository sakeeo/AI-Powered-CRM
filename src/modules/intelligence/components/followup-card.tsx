"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { FOLLOWUP_CHANNEL_LABEL, type FollowUpChannel } from "@/modules/intelligence/followup";
import type { FollowUpSubject } from "@/modules/intelligence/schemas";
import {
  acceptFollowUpRecommendation,
  rejectFollowUpRecommendation,
} from "@/modules/intelligence/server/followup-actions";

export type FollowUpView = {
  basis: "party" | "org" | "none";
  channel: FollowUpChannel | null;
  /** ISO string (aman dikirim ke client). */
  suggestedAt: string;
  rationale: string[];
  draft: { subject: string; body: string };
};

/** Rekomendasi follow-up (waktu/kanal/draf). Menjadi task hanya saat pengguna menerima. */
export function FollowUpCard({
  subject,
  rec,
  canCreate,
}: {
  subject: FollowUpSubject;
  rec: FollowUpView;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const when = new Date(rec.suggestedAt).toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (done) return null;
  return (
    <Card data-testid="followup-card">
      <CardHeader>
        <div>
          <CardTitle>Rekomendasi follow-up</CardTitle>
          <CardDescription>
            Draf berdasarkan pola interaksi historis. Tidak ada pesan yang dikirim otomatis.
          </CardDescription>
        </div>
        <ToneBadge tone={rec.basis === "none" ? "blue" : "purple"}>
          {rec.basis === "party"
            ? "Pola pelanggan"
            : rec.basis === "org"
              ? "Pola organisasi"
              : "Belum ada pola"}
        </ToneBadge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Kanal: </span>
            {rec.channel ? FOLLOWUP_CHANNEL_LABEL[rec.channel] : "—"}
          </span>
          <span>
            <span className="text-muted-foreground">Waktu: </span>
            {when}
          </span>
        </div>
        <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
          {rec.rationale.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{rec.draft.subject}</p>
          <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">{rec.draft.body}</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await acceptFollowUpRecommendation(subject);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Task follow-up dibuat");
                    setDone(true);
                    router.refresh();
                  }
                })
              }
            >
              Buat task follow-up
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await rejectFollowUpRecommendation(subject);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Umpan balik tercatat");
                    setDone(true);
                  }
                })
              }
            >
              Tidak relevan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
