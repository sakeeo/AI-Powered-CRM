import { Prisma } from "@/generated/prisma/client";

/** Konversi Decimal database ↔ string. Server-only (menarik runtime Prisma); jangan diimpor dari client component. */
export const toDecimal = (v: string | undefined | null) => (v == null ? null : new Prisma.Decimal(v));
export const decimalToString = (d: Prisma.Decimal | null | undefined) =>
  d == null ? null : d.toFixed(2);
