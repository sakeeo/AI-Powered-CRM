import { dateInTz, zonedToUtc } from "@/lib/timezone";

/**
 * Rekomendasi follow-up (plan 3.3): pola interaksi historis → kanal, waktu, dan DRAF isi. Murni & deterministik.
 * Hanya saran; menjadi task hanya bila pengguna menekan "Buat task" (aksi eksplisit, tercatat sebagai umpan balik).
 */
export const FOLLOWUP_CHANNELS = ["whatsapp", "call", "email", "meeting"] as const;
export type FollowUpChannel = (typeof FOLLOWUP_CHANNELS)[number];
export const FOLLOWUP_CHANNEL_LABEL: Record<FollowUpChannel, string> = {
  whatsapp: "WhatsApp",
  call: "Telepon",
  email: "Email",
  meeting: "Meeting",
};

export type Interaction = {
  channel: FollowUpChannel;
  at: Date;
  /** true = inisiatif pelanggan (mis. pesan WhatsApp masuk) — bobot lebih tinggi. */
  inbound: boolean;
};

export const MIN_PARTY_SAMPLE = 3;
export const MIN_ORG_SAMPLE = 10;
const DAY = 86_400_000;
const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type FollowUpRecommendation = {
  basis: "party" | "org" | "none";
  sample: number;
  channel: FollowUpChannel | null;
  channelShare: number;
  weekday: number | null;
  hour: number | null;
  /** Waktu yang disarankan (UTC). */
  suggestedAt: Date;
  cadenceDays: number | null;
  rationale: string[];
  draft: { subject: string; body: string };
};

function localParts(at: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday!);
  return { weekday, hour: Number(p.hour) };
}

const mode = (xs: number[]) => {
  const c = new Map<number, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
};
const medianOf = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Waktu kerja: jam disarankan dibatasi 08–17 agar tidak menyarankan tengah malam. */
const businessHour = (h: number) => Math.min(17, Math.max(8, h));

export function draftFor(channel: FollowUpChannel | null, name: string, daysSince: number | null) {
  const since =
    daysSince === null
      ? ""
      : daysSince <= 1
        ? " yang baru saja kita lakukan"
        : ` sekitar ${daysSince} hari lalu`;
  switch (channel) {
    case "email":
      return {
        subject: `Tindak lanjut — ${name}`,
        body: `Yth. ${name},\n\nTerima kasih atas waktu dan diskusi${since}. Kami ingin menindaklanjuti apakah ada informasi tambahan yang Anda butuhkan atau pertanyaan yang bisa kami bantu jawab.\n\nSilakan kabari kami bila ada hal yang ingin dibahas lebih lanjut.\n\nSalam hangat`,
      };
    case "call":
      return {
        subject: `Telepon follow-up: ${name}`,
        body: `Poin pembicaraan untuk ${name}:\n- Sapa & ingatkan topik terakhir${since}\n- Tanyakan perkembangan kebutuhan dan kendala\n- Tawarkan langkah berikutnya (demo / quotation / meeting)\n- Catat hasil panggilan di timeline`,
      };
    case "meeting":
      return {
        subject: `Jadwalkan meeting: ${name}`,
        body: `Ajukan meeting lanjutan dengan ${name}.\n- Tujuan: bahas kebutuhan & langkah berikutnya\n- Usulkan 2–3 slot waktu\n- Siapkan ringkasan diskusi sebelumnya${since}`,
      };
    case "whatsapp":
      return {
        subject: `WhatsApp follow-up: ${name}`,
        body: `Halo ${name}, kami ingin menindaklanjuti komunikasi kita${since}. Apakah ada yang bisa kami bantu atau jelaskan lebih lanjut? Terima kasih 🙏`,
      };
    default:
      return {
        subject: `Follow-up: ${name}`,
        body: `Hubungi ${name} untuk menindaklanjuti komunikasi terakhir. Pilih kanal yang paling nyaman bagi pelanggan, lalu catat hasilnya di timeline.`,
      };
  }
}

export function recommendFollowUp(input: {
  name: string;
  party: Interaction[];
  org: Interaction[];
  now: Date;
  timezone: string;
}): FollowUpRecommendation {
  const { name, party, org, now, timezone: tz } = input;
  const useParty = party.length >= MIN_PARTY_SAMPLE;
  const useOrg = !useParty && org.length >= MIN_ORG_SAMPLE;
  const basis = useParty ? "party" : useOrg ? "org" : "none";
  const rows = useParty ? party : useOrg ? org : [];
  const rationale: string[] = [];

  const last = party.length ? new Date(Math.max(...party.map((p) => p.at.getTime()))) : null;
  const daysSince = last ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / DAY)) : null;

  if (basis === "none") {
    rationale.push(
      `Belum cukup pola interaksi (${party.length}/${MIN_PARTY_SAMPLE} untuk pelanggan ini, ${org.length}/${MIN_ORG_SAMPLE} secara organisasi).`,
    );
    const start = new Date(now.getTime() + DAY);
    const date = dateInTz(start, tz);
    return {
      basis,
      sample: rows.length,
      channel: null,
      channelShare: 0,
      weekday: null,
      hour: null,
      suggestedAt: zonedToUtc(`${date}T10:00`, tz),
      cadenceDays: null,
      rationale,
      draft: draftFor(null, name, daysSince),
    };
  }

  // Kanal: jumlah berbobot (pesan masuk = 2).
  const w = new Map<FollowUpChannel, number>();
  let total = 0;
  for (const r of rows) {
    const x = r.inbound ? 2 : 1;
    w.set(r.channel, (w.get(r.channel) ?? 0) + x);
    total += x;
  }
  const channel = [...w.entries()].sort(
    (a, b) => b[1] - a[1] || FOLLOWUP_CHANNELS.indexOf(a[0]) - FOLLOWUP_CHANNELS.indexOf(b[0]),
  )[0]![0];
  const share = w.get(channel)! / total;

  const parts = rows.map((r) => localParts(r.at, tz));
  const weekday = mode(parts.map((p) => p.weekday))!;
  const hour = businessHour(mode(parts.map((p) => p.hour))!);

  // Kadens: median jarak antar interaksi pelanggan ini (1–30 hari).
  let cadenceDays: number | null = null;
  if (party.length >= 2) {
    const ts = party.map((p) => p.at.getTime()).sort((a, b) => a - b);
    const gaps = ts.slice(1).map((t, i) => (t - ts[i]!) / DAY);
    const med = medianOf(gaps);
    if (med !== null) cadenceDays = Math.min(30, Math.max(1, Math.round(med)));
  }
  const earliest = Math.max(
    now.getTime() + 3_600_000,
    last && cadenceDays ? last.getTime() + cadenceDays * DAY : 0,
  );

  // Hari pilihan berikutnya (weekday) pada jam pilihan, tidak lebih awal dari `earliest`.
  let suggestedAt = new Date(earliest);
  for (let d = 0; d <= 14; d++) {
    const date = dateInTz(new Date(earliest + d * DAY), tz);
    if (new Date(`${date}T12:00:00Z`).getUTCDay() !== weekday) continue;
    const cand = zonedToUtc(`${date}T${String(hour).padStart(2, "0")}:00`, tz);
    if (cand.getTime() >= earliest) {
      suggestedAt = cand;
      break;
    }
  }

  rationale.push(
    basis === "party"
      ? `Pola dari ${party.length} interaksi dengan ${name}.`
      : `Pelanggan ini belum punya cukup riwayat; memakai pola ${org.length} interaksi seluruh organisasi.`,
    `Kanal terbanyak: ${FOLLOWUP_CHANNEL_LABEL[channel]} (${Math.round(share * 100)}% berbobot; pesan masuk dihitung 2×).`,
    `Waktu interaksi paling sering: ${WEEKDAYS[weekday]} sekitar pukul ${String(hour).padStart(2, "0")}.00 (${tz}).`,
  );
  if (cadenceDays) rationale.push(`Jeda antar interaksi biasanya ±${cadenceDays} hari.`);
  if (daysSince !== null) rationale.push(`Interaksi terakhir ${daysSince} hari lalu.`);

  return {
    basis,
    sample: rows.length,
    channel,
    channelShare: share,
    weekday,
    hour,
    suggestedAt,
    cadenceDays,
    rationale,
    draft: draftFor(channel, name, daysSince),
  };
}

/** AI Draft Acceptance Rate = diterima / (diterima + ditolak). null bila belum ada umpan balik. */
export function acceptanceRate(accepted: number, rejected: number): number | null {
  const n = accepted + rejected;
  return n === 0 ? null : accepted / n;
}
