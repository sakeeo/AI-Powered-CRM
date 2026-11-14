/** Jenis kanal percakapan terpadu (plan 3.6). `other` = kanal lain yang dicatat manual (Instagram, Telegram, dst.). */
export const CHANNEL_KINDS = ["whatsapp", "email", "other"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];
export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  other: "Lainnya",
};
export const CHANNEL_TONE: Record<ChannelKind, "green" | "blue" | "purple"> = {
  whatsapp: "green",
  email: "blue",
  other: "purple",
};

export const ROUTING_STRATEGIES = ["none", "sticky_owner", "round_robin"] as const;
export type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];
export const ROUTING_LABEL: Record<RoutingStrategy, { title: string; description: string }> = {
  none: {
    title: "Tanpa routing",
    description: "Percakapan baru belum ditugaskan; tim mengambil sendiri.",
  },
  sticky_owner: {
    title: "Ikuti PIC record",
    description:
      "Ditugaskan ke PIC contact/lead yang cocok; bila tak ada PIC, giliran bergilir dari pool (bila diisi).",
  },
  round_robin: {
    title: "Bergilir (round robin)",
    description:
      "Dibagi bergantian di antara anggota pool (kosong = semua anggota aktif non-viewer).",
  },
};

/** Peran yang dapat menerima penugasan percakapan (viewer tidak dapat menangani inbox). */
export const ASSIGNABLE_ROLES = ["owner", "admin", "sales_manager", "sales_rep"] as const;

export const MAX_CHANNEL_LABEL = 40;
