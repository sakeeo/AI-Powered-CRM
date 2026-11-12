import Link from "next/link";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogChannelForm } from "@/modules/omnichannel/components/log-channel-form";
import { channelLabelOf, type TimelineItem } from "@/modules/omnichannel/timeline";

const TONE: Record<string, "green" | "blue" | "purple" | "orange"> = {
  whatsapp: "green",
  email: "blue",
  other: "purple",
  call: "orange",
  meeting: "orange",
  note: "purple",
  task: "blue",
};

/** Timeline komunikasi terpadu lintas kanal (pesan + aktivitas) untuk satu customer/lead. */
export function UnifiedTimeline({
  items,
  logSubject,
}: {
  items: TimelineItem[];
  /** Bila diisi, tampilkan form catat percakapan kanal lain (hanya contact/lead). */
  logSubject?: { type: "contact" | "lead"; id: string };
}) {
  return (
    <Card data-testid="unified-timeline">
      <CardHeader>
        <div>
          <CardTitle>Timeline komunikasi terpadu</CardTitle>
          <CardDescription>
            Percakapan WhatsApp, email, kanal lain, dan aktivitas dalam satu urutan waktu.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {logSubject && <LogChannelForm subject={logSubject} />}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada komunikasi tercatat.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((i) => (
              <li key={i.id} className="space-y-0.5 px-3 py-2.5" data-channel={i.channel}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <ToneBadge tone={TONE[i.channel] ?? "blue"}>
                    {channelLabelOf(i.channel)}
                  </ToneBadge>
                  {i.direction && (
                    <span className="text-muted-foreground">
                      {i.direction === "in" ? "Masuk" : "Keluar"}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(i.at).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {i.href && (
                    <Link className="text-primary ml-auto hover:underline" href={i.href}>
                      Buka di Inbox
                    </Link>
                  )}
                </div>
                {i.title && <p className="text-sm font-medium">{i.title}</p>}
                {i.text && (
                  <p className="text-muted-foreground line-clamp-3 text-xs whitespace-pre-wrap">
                    {i.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
