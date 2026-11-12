/** Spesifikasi grafik laporan (serializable: dikirim dari Server Component ke Client). */
export type ChartSpec = {
  title: string;
  description?: string;
  kind: "bar" | "hbar" | "donut" | "line";
  /** Baris data; `xKey` = kolom label, `series[].key` = kolom nilai numerik. */
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; name: string }[];
  format?: "number" | "percent" | "money";
  /** Kode mata uang untuk format "money". */
  unit?: string;
};
