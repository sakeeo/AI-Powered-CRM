/**
 * Tone semantik (design-system §2.3). Kelas ditulis penuh agar terdeteksi Tailwind.
 * Makna: blue=netral/info, green=positif, orange=perhatian/pending, purple=kategori/nilai, red=negatif/urgent.
 */
export type Tone = "blue" | "green" | "orange" | "purple" | "red";

export const TONE_CLASS: Record<
  Tone,
  { solid: string; soft: string; border: string; ink: string; bar: string }
> = {
  blue: {
    solid: "bg-tone-blue text-white",
    soft: "bg-tone-blue-soft",
    border: "border-tone-blue-border",
    ink: "text-tone-blue-ink",
    bar: "bg-tone-blue",
  },
  green: {
    solid: "bg-tone-green text-white",
    soft: "bg-tone-green-soft",
    border: "border-tone-green-border",
    ink: "text-tone-green-ink",
    bar: "bg-tone-green",
  },
  orange: {
    solid: "bg-tone-orange text-white",
    soft: "bg-tone-orange-soft",
    border: "border-tone-orange-border",
    ink: "text-tone-orange-ink",
    bar: "bg-tone-orange",
  },
  purple: {
    solid: "bg-tone-purple text-white",
    soft: "bg-tone-purple-soft",
    border: "border-tone-purple-border",
    ink: "text-tone-purple-ink",
    bar: "bg-tone-purple",
  },
  red: {
    solid: "bg-tone-red text-white",
    soft: "bg-tone-red-soft",
    border: "border-tone-red-border",
    ink: "text-tone-red-ink",
    bar: "bg-tone-red",
  },
};
