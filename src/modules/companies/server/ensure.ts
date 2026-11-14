import type { ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";

/**
 * Pastikan company dengan nama ini ada di database (dipakai saat lead disimpan dengan nama
 * perusahaan baru). Pencocokan nama tidak peka huruf besar/kecil agar tidak membuat duplikat.
 * Dilewati bila user tidak berhak membuat Company. Mengembalikan id company bila ada/dibuat.
 */
export async function ensureCompanyByName(
  ctx: ActionContext,
  rawName: string | null | undefined,
  ownerId: string | null,
): Promise<string | null> {
  const name = rawName?.trim();
  if (!name) return null;
  const existing = await ctx.db.company.findFirst({
    where: { deletedAt: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  if (!ctx.ability.can("create", "Company")) return null;
  const company = await ctx.db.company.create({
    data: { name, ownerId: ownerId ?? ctx.userId, createdBy: ctx.userId } as never,
  });
  await writeAudit(ctx, {
    action: "company.created",
    entityType: "Company",
    entityId: company.id,
    after: { name: company.name, source: "lead" },
  });
  return company.id;
}
