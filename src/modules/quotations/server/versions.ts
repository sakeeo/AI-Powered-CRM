import type { TenantContext } from "@/lib/context";
import { sameSnapshot, type Snapshot } from "@/modules/quotations/versioning";

type Db = TenantContext["db"];

/** Bangun snapshot dari baris quotation + item (semua angka → string). */
export async function buildSnapshot(db: Db, quotationId: string): Promise<Snapshot | null> {
  const q = await db.quotation.findFirst({
    where: { id: quotationId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!q) return null;
  return {
    title: q.title,
    validUntil: q.validUntil.toISOString().slice(0, 10),
    currency: q.currency,
    contactId: q.contactId,
    companyId: q.companyId,
    notes: q.notes,
    terms: q.terms,
    narrative: q.narrative,
    taxLabel: q.taxLabel,
    taxRate: q.taxRate.toFixed(2),
    taxInclusive: q.taxInclusive,
    globalDiscountPercent: q.globalDiscountPercent.toFixed(2),
    subtotal: q.subtotal.toFixed(2),
    discountTotal: q.discountTotal.toFixed(2),
    taxTotal: q.taxTotal.toFixed(2),
    total: q.total.toFixed(2),
    items: q.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      description: i.description,
      quantity: i.quantity.toFixed(2),
      unitPrice: i.unitPrice.toFixed(2),
      discountPercent: i.discountPercent.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
    })),
  };
}

/**
 * Catat versi baru bila isi berbeda dari versi terakhir (atau `force`, mis. saat dikirim ke pelanggan:
 * penanda "yang ini yang dikirim"). Mengembalikan nomor versi atau null bila tidak ada perubahan.
 */
export async function recordVersion(
  db: Db,
  quotationId: string,
  opts: { label: string; userId: string | null; force?: boolean },
): Promise<number | null> {
  const snap = await buildSnapshot(db, quotationId);
  if (!snap) return null;
  const last = await db.quotationVersion.findFirst({
    where: { quotationId },
    orderBy: { version: "desc" },
  });
  if (last && !opts.force && sameSnapshot(last.snapshot as unknown as Snapshot, snap)) return null;
  const version = (last?.version ?? 0) + 1;
  try {
    await db.quotationVersion.create({
      data: {
        quotationId,
        version,
        label: opts.label,
        snapshot: snap as never,
        total: snap.total,
        createdBy: opts.userId,
      } as never,
    });
  } catch (e) {
    // Dua penyimpanan bersamaan memperebutkan nomor yang sama: yang kalah dianggap sudah tercatat.
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
  return version;
}

export async function listVersions(db: Db, quotationId: string) {
  const rows = await db.quotationVersion.findMany({
    where: { quotationId },
    orderBy: { version: "desc" },
    take: 100,
    select: { id: true, version: true, label: true, total: true, createdBy: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, total: r.total.toFixed(2) }));
}

export async function getVersionSnapshots(db: Db, quotationId: string, versions: number[]) {
  const rows = await db.quotationVersion.findMany({
    where: { quotationId, version: { in: versions } },
  });
  return new Map(rows.map((r) => [r.version, r.snapshot as unknown as Snapshot]));
}
