import type { Prisma } from "@/generated/prisma/client";
import type { ActionContext } from "@/lib/action";
import { AppError } from "@/lib/errors";
import {
  readValues,
  validateCustomValues,
  type CustomValues,
} from "@/modules/customization/custom-fields";
import type { CustomEntity } from "@/modules/customization/constants";
import { loadFieldDefs } from "@/modules/customization/server/queries";

/**
 * Validasi nilai custom field dari form terhadap definisi tenant dan kembalikan objek siap simpan.
 * Melempar AppError (pesan menyebut field yang salah) bila ada nilai tidak valid.
 * Hanya dipanggil bila `raw` disertakan; `existing` mempertahankan nilai field nonaktif.
 */
export async function prepareCustomFields(
  ctx: Pick<ActionContext, "db">,
  entity: CustomEntity,
  raw: CustomValues | undefined,
  existing?: unknown,
): Promise<Prisma.InputJsonObject> {
  const defs = await loadFieldDefs(ctx.db, entity);
  const { values, errors } = validateCustomValues(defs, raw ?? {}, readValues(existing));
  const first = Object.values(errors)[0];
  if (first) throw new AppError(first);
  return values as Prisma.InputJsonObject;
}

/** Ganti seluruh tag sebuah record. Tag harus milik tenant; izin = boleh mengubah record. */
export async function applyTags(
  ctx: ActionContext,
  entity: CustomEntity,
  entityId: string,
  tagIds: string[],
) {
  const ids = Array.from(new Set(tagIds));
  if (ids.length) {
    const found = await ctx.db.tag.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new AppError("Ada tag yang tidak ditemukan");
  }
  const existing = await ctx.db.taggable.findMany({
    where: { entityType: entity, entityId },
    select: { id: true, tagId: true },
  });
  const keep = new Set(ids);
  const remove = existing.filter((e) => !keep.has(e.tagId)).map((e) => e.id);
  const have = new Set(existing.map((e) => e.tagId));
  const add = ids.filter((id) => !have.has(id));
  if (remove.length) await ctx.db.taggable.deleteMany({ where: { id: { in: remove } } });
  if (add.length) {
    await ctx.db.taggable.createMany({
      data: add.map((tagId) => ({
        tagId,
        entityType: entity,
        entityId,
        organizationId: ctx.organizationId,
      })),
    });
  }
  return { added: add.length, removed: remove.length };
}
