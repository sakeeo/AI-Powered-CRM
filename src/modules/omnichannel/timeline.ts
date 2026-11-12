import { ACTIVITY_TYPE_LABEL, type ActivityType } from "@/modules/activities/constants";

/** Satu entri timeline terpadu: pesan percakapan atau aktivitas, dari kanal mana pun. */
export type TimelineItem = {
  id: string;
  at: Date;
  source: "message" | "activity";
  /** whatsapp | email | other | call | meeting | note | task */
  channel: string;
  direction: "in" | "out" | null;
  title: string;
  /** Teks polos (HTML aktivitas sudah dibersihkan). */
  text: string;
  href: string | null;
};

export const stripHtml = (html: string | null | undefined) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/** Aktivitas yang dicatat otomatis dari pesan WhatsApp (sudah muncul sebagai pesan) tidak ditampilkan ganda. */
export const isAutoLoggedMessageActivity = (a: { type: string; subject: string }) =>
  a.type === "whatsapp" && /^WhatsApp (masuk|keluar):/.test(a.subject);

export function channelLabelOf(channel: string) {
  return (
    { whatsapp: "WhatsApp", email: "Email", other: "Lainnya" }[channel] ??
    ACTIVITY_TYPE_LABEL[channel as ActivityType] ??
    channel
  );
}

/** Gabungkan, urutkan terbaru dulu, dan batasi. */
export function mergeTimeline(items: TimelineItem[], limit = 100): TimelineItem[] {
  return [...items].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
