"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { tenantAction, type ActionContext } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { idInput } from "@/lib/schema-helpers";
import {
  CUSTOM_ENTITIES,
  ENTITY_SUBJECT,
  MAX_FIELDS_PER_ENTITY,
  type TagColor,
} from "@/modules/customization/constants";
import {
  slugifyKey,
  validateConditionGraph,
  type FieldDef,
} from "@/modules/customization/custom-fields";
import {
  createFieldSchema,
  reorderFieldsSchema,
  savedViewSchema,
  setEntityTagsSchema,
  tagSchema,
  updateFieldSchema,
  updateSavedViewSchema,
  updateTagSchema,
} from "@/modules/customization/schemas";
import { applyTags } from "@/modules/customization/server/apply";
import { loadFieldDefs, toFieldDef } from "@/modules/customization/server/queries";

const ENTITY_PATHS = {
  lead: "/leads",
  contact: "/contacts",
  company: "/companies",
  deal: "/deals",
};

// ---------------------------------------------------------------- Tags
async function assertTagNameFree(ctx: ActionContext, name: string, exceptId?: string) {
  const dup = await ctx.db.tag.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw new AppError("Tag dengan nama itu sudah ada");
}

export const createTag = tenantAction(tagSchema, async (ctx, input) => {
  assertCan(ctx, "create", "Tag");
  await assertTagNameFree(ctx, input.name);
  const tag = await ctx.db.tag.create({ data: { ...input, createdBy: ctx.userId } as never });
  await writeAudit(ctx, {
    action: "tag.created",
    entityType: "Tag",
    entityId: tag.id,
    after: { name: tag.name },
  });
  revalidatePath("/settings/tags");
  return { id: tag.id, name: tag.name, color: input.color };
});

export const updateTag = tenantAction(updateTagSchema, async (ctx, { id, ...input }) => {
  assertCan(ctx, "update", "Tag");
  const existing = await ctx.db.tag.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Tag");
  await assertTagNameFree(ctx, input.name, id);
  await ctx.db.tag.update({ where: { id }, data: { ...input, updatedBy: ctx.userId } });
  await writeAudit(ctx, {
    action: "tag.updated",
    entityType: "Tag",
    entityId: id,
    before: { name: existing.name, color: existing.color },
    after: input,
  });
  revalidatePath("/settings/tags");
});

export const deleteTag = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "delete", "Tag");
  const existing = await ctx.db.tag.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Tag");
  await ctx.db.tag.delete({ where: { id } }); // taggables ikut terhapus (cascade)
  await writeAudit(ctx, {
    action: "tag.deleted",
    entityType: "Tag",
    entityId: id,
    before: { name: existing.name },
  });
  revalidatePath("/settings/tags");
});

/** Ganti tag sebuah record dari halaman detail. Perlu izin mengubah record itu. */
export const setEntityTags = tenantAction(
  setEntityTagsSchema,
  async (ctx, { entityType, entityId, tagIds }) => {
    const model = ctx.db[entityType] as unknown as {
      findFirst: (a: unknown) => Promise<object | null>;
    };
    const record = await model.findFirst({ where: { id: entityId } });
    if (!record) throw NotFoundError("Data");
    assertCan(ctx, "update", ENTITY_SUBJECT[entityType], record);
    const res = await applyTags(ctx, entityType, entityId, tagIds);
    await writeAudit(ctx, {
      action: "tag.assigned",
      entityType,
      entityId,
      after: { tagIds },
    });
    revalidatePath(`${ENTITY_PATHS[entityType]}/${entityId}`);
    revalidatePath(ENTITY_PATHS[entityType]);
    return res;
  },
);

// ---------------------------------------------------------------- Custom fields
async function uniqueKey(ctx: ActionContext, entity: string, base: string) {
  const root = base || "field";
  let key = /^[a-z]/.test(root) ? root : `f_${root}`;
  key = key.slice(0, 36);
  for (let i = 1; i < 100; i++) {
    const hit = await ctx.db.customFieldDefinition.findFirst({
      where: { entityType: entity, key },
      select: { id: true },
    });
    if (!hit) return key;
    key = `${root.slice(0, 33)}_${i + 1}`;
  }
  throw new AppError("Tidak dapat membuat kunci field unik");
}

function assertGraph(defs: FieldDef[]) {
  const problem = validateConditionGraph(defs);
  if (problem) throw new AppError(problem);
}

export const createCustomField = tenantAction(createFieldSchema, async (ctx, input) => {
  assertCan(ctx, "create", "CustomField");
  const existing = await loadFieldDefs(ctx.db, input.entityType);
  if (existing.length >= MAX_FIELDS_PER_ENTITY)
    throw new AppError(`Maksimal ${MAX_FIELDS_PER_ENTITY} custom field per entitas`);
  const key = input.key
    ? await (async () => {
        if (existing.some((d) => d.key === input.key))
          throw new AppError("Kunci field sudah dipakai");
        return input.key!;
      })()
    : await uniqueKey(ctx, input.entityType, slugifyKey(input.label));
  const options = input.type === "select" || input.type === "multiselect" ? input.options : [];
  const position = existing.length ? Math.max(...existing.map((d) => d.position)) + 1 : 0;
  assertGraph([...existing, { key, visibleWhen: input.visibleWhen } as FieldDef]);
  const row = await ctx.db.customFieldDefinition.create({
    data: {
      entityType: input.entityType,
      key,
      label: input.label,
      type: input.type,
      options,
      required: input.required,
      showInTable: input.showInTable,
      filterable: input.filterable,
      visibleWhen: input.visibleWhen ?? undefined,
      position,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "custom_field.created",
    entityType: "CustomField",
    entityId: row.id,
    after: { entity: input.entityType, key, type: input.type },
  });
  revalidatePath("/settings/custom-fields");
  revalidatePath(ENTITY_PATHS[input.entityType]);
  return { id: row.id, key };
});

/** Ubah definisi. Kunci & tipe tidak berubah (nilai tersimpan tetap valid). */
export const updateCustomField = tenantAction(updateFieldSchema, async (ctx, input) => {
  assertCan(ctx, "update", "CustomField");
  const existing = await ctx.db.customFieldDefinition.findFirst({ where: { id: input.id } });
  if (!existing) throw NotFoundError("Custom field");
  if (existing.type !== input.type)
    throw new AppError("Tipe field tidak dapat diubah. Buat field baru bila perlu tipe lain.");
  const all = await loadFieldDefs(ctx.db, existing.entityType as never);
  assertGraph(all.map((d) => (d.id === input.id ? { ...d, visibleWhen: input.visibleWhen } : d)));
  const options = input.type === "select" || input.type === "multiselect" ? input.options : [];
  await ctx.db.customFieldDefinition.update({
    where: { id: input.id },
    data: {
      label: input.label,
      options,
      required: input.required,
      showInTable: input.showInTable,
      filterable: input.filterable,
      visibleWhen: input.visibleWhen ?? Prisma.DbNull,
      isActive: input.isActive,
      updatedBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "custom_field.updated",
    entityType: "CustomField",
    entityId: input.id,
    before: toFieldDef(existing),
    after: { label: input.label, required: input.required, isActive: input.isActive },
  });
  revalidatePath("/settings/custom-fields");
  revalidatePath(ENTITY_PATHS[existing.entityType as keyof typeof ENTITY_PATHS]);
});

export const reorderCustomFields = tenantAction(reorderFieldsSchema, async (ctx, input) => {
  assertCan(ctx, "update", "CustomField");
  const defs = await loadFieldDefs(ctx.db, input.entityType);
  const known = new Set(defs.map((d) => d.id));
  if (input.ids.some((id) => !known.has(id))) throw new AppError("Field tidak ditemukan");
  await ctx.db.$transaction(
    input.ids.map((id, position) =>
      ctx.db.customFieldDefinition.update({ where: { id }, data: { position } }),
    ),
  );
  revalidatePath("/settings/custom-fields");
});

/** Hapus definisi; nilai lama di record tetap ada di JSONB tetapi tidak lagi ditampilkan. */
export const deleteCustomField = tenantAction(idInput, async (ctx, { id }) => {
  assertCan(ctx, "delete", "CustomField");
  const existing = await ctx.db.customFieldDefinition.findFirst({ where: { id } });
  if (!existing) throw NotFoundError("Custom field");
  const others = (await loadFieldDefs(ctx.db, existing.entityType as never)).filter(
    (d) => d.id !== id,
  );
  const dependents = others.filter((d) => d.visibleWhen?.fieldKey === existing.key);
  if (dependents.length)
    throw new AppError(
      `Field masih dipakai sebagai kondisi oleh: ${dependents.map((d) => d.label).join(", ")}`,
    );
  await ctx.db.customFieldDefinition.delete({ where: { id } });
  await writeAudit(ctx, {
    action: "custom_field.deleted",
    entityType: "CustomField",
    entityId: id,
    before: { entity: existing.entityType, key: existing.key },
  });
  revalidatePath("/settings/custom-fields");
});

// ---------------------------------------------------------------- Saved views
async function assertShareable(ctx: ActionContext, visibility: string, teamId: string | undefined) {
  if (visibility === "personal") return undefined;
  if (visibility === "organization") {
    if (!["owner", "admin", "sales_manager"].includes(ctx.role))
      throw new AppError(
        "Hanya Owner, Admin, atau Sales Manager yang dapat membagikan ke organisasi",
        403,
        "forbidden",
      );
    return undefined;
  }
  if (!teamId) throw new AppError("Pilih tim untuk dibagikan");
  const member = await ctx.db.teamMember.findFirst({
    where: { teamId, userId: ctx.userId },
    select: { id: true },
  });
  if (!member && !["owner", "admin"].includes(ctx.role))
    throw new AppError("Anda bukan anggota tim itu", 403, "forbidden");
  const team = await ctx.db.team.findFirst({ where: { id: teamId }, select: { id: true } });
  if (!team) throw new AppError("Tim tidak ditemukan");
  return teamId;
}

/** Hanya parameter daftar yang aman: tanpa `page`, panjang dibatasi. */
function cleanParams(params: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([k, v]) => /^[a-zA-Z0-9_]{1,40}$/.test(k) && k !== "page" && v !== "",
    ),
  );
}

async function clearDefaults(ctx: ActionContext, entityType: string, exceptId?: string) {
  await ctx.db.savedView.updateMany({
    where: {
      entityType,
      ownerId: ctx.userId,
      isDefault: true,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

export const createSavedView = tenantAction(savedViewSchema, async (ctx, input) => {
  const teamId = await assertShareable(ctx, input.visibility, input.teamId);
  if (input.isDefault) await clearDefaults(ctx, input.entityType);
  const row = await ctx.db.savedView.create({
    data: {
      entityType: input.entityType,
      name: input.name,
      visibility: input.visibility,
      teamId: teamId ?? null,
      ownerId: ctx.userId,
      params: cleanParams(input.params),
      isDefault: input.isDefault,
      createdBy: ctx.userId,
    } as never,
  });
  await writeAudit(ctx, {
    action: "saved_view.created",
    entityType: "SavedView",
    entityId: row.id,
    after: { name: input.name, entity: input.entityType, visibility: input.visibility },
  });
  return { id: row.id };
});

async function ownView(ctx: ActionContext, id: string) {
  const v = await ctx.db.savedView.findFirst({ where: { id } });
  if (!v) throw NotFoundError("Tampilan");
  if (v.ownerId !== ctx.userId && !["owner", "admin"].includes(ctx.role)) throw ForbiddenError();
  return v;
}

export const updateSavedView = tenantAction(updateSavedViewSchema, async (ctx, input) => {
  const v = await ownView(ctx, input.id);
  const visibility = input.visibility ?? v.visibility;
  const teamId =
    visibility === v.visibility && !input.teamId
      ? v.teamId
      : await assertShareable(ctx, visibility, input.teamId ?? v.teamId ?? undefined);
  if (input.isDefault && v.ownerId === ctx.userId) await clearDefaults(ctx, v.entityType, v.id);
  await ctx.db.savedView.update({
    where: { id: v.id },
    data: {
      name: input.name ?? v.name,
      visibility,
      teamId: visibility === "team" ? (teamId ?? null) : null,
      ...(input.isDefault !== undefined && v.ownerId === ctx.userId
        ? { isDefault: input.isDefault }
        : {}),
      updatedBy: ctx.userId,
    },
  });
});

export const deleteSavedView = tenantAction(idInput, async (ctx, { id }) => {
  const v = await ownView(ctx, id);
  await ctx.db.savedView.delete({ where: { id: v.id } });
  await writeAudit(ctx, {
    action: "saved_view.deleted",
    entityType: "SavedView",
    entityId: id,
    before: { name: v.name },
  });
});

// ---------------------------------------------------------------- Data untuk form
/** Definisi field aktif + daftar tag untuk form entitas (dimuat saat form dibuka; tanpa prop drilling). */
export const getFormCustomization = tenantAction(
  z.object({ entity: z.enum(CUSTOM_ENTITIES) }),
  async (ctx, { entity }) => {
    const [defs, tags] = await Promise.all([
      loadFieldDefs(ctx.db, entity, { activeOnly: true }),
      ctx.db.tag.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true },
      }),
    ]);
    return {
      defs,
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color as TagColor })),
      canCreateTag: ctx.ability.can("create", "Tag"),
    };
  },
);
