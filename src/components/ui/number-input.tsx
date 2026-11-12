"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/** Kelompokkan ribuan (titik) dan pisah desimal (koma) — format Indonesia — dari string kanonik "1234567.5". */
export function formatCanonical(canonical: string): string {
  if (!canonical) return "";
  const [int = "", frac] = canonical.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac !== undefined ? `${grouped},${frac}` : grouped;
}

/**
 * Ubah ketikan pengguna menjadi string kanonik (digit + "." desimal opsional).
 * Titik = pemisah ribuan (diabaikan), koma = desimal. Satu titik dengan 1..`decimals` digit
 * setelahnya dan tanpa koma ("1234.56") diperlakukan sebagai desimal (paste/format internasional).
 */
export function parseNumberInput(raw: string, decimals: number): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const dots = (s.match(/\./g) ?? []).length;
  if (decimals > 0 && !s.includes(",") && dots === 1) {
    const after = s.split(".")[1];
    if (after.length >= 1 && after.length <= decimals) s = s.replace(".", ",");
  }
  s = s.replace(/\./g, "");
  const comma = s.indexOf(",");
  if (decimals === 0 || comma === -1) {
    const int = s.replace(/,/g, "").replace(/^0+(?=\d)/, "");
    return int;
  }
  const int =
    s
      .slice(0, comma)
      .replace(/,/g, "")
      .replace(/^0+(?=\d)/, "") || "0";
  const frac = s
    .slice(comma + 1)
    .replace(/,/g, "")
    .slice(0, decimals);
  return `${int}.${frac}`;
}

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  /** Nilai kanonik: "1234567.5" (bukan format tampilan). */
  value: string;
  onValueChange: (value: string) => void;
  /** Jumlah digit desimal maksimum; 0 = bilangan bulat. */
  decimals?: number;
};

/**
 * Input angka/uang berformat Indonesia (1.234.567,50). Menampilkan pemisah ribuan saat mengetik,
 * tetapi nilai yang dilaporkan (`onValueChange`) tetap string desimal kanonik untuk validasi/server.
 */
export function NumberInput({ value, onValueChange, decimals = 2, onBlur, ...props }: Props) {
  return (
    <Input
      {...props}
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      value={formatCanonical(value ?? "")}
      onChange={(e) => onValueChange(parseNumberInput(e.target.value, decimals))}
      onBlur={(e) => {
        if (value?.endsWith(".")) onValueChange(value.slice(0, -1));
        onBlur?.(e);
      }}
    />
  );
}
