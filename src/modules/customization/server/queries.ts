import type { SavedView } from "@/generated/prisma/client";
import { assertCan } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import {
  customFieldWhere,
  type FieldDef,
  type FieldOption,
  type VisibleWhen,
} from "@/modules/customization/custom-fields";
import {
  TAG_PARAM,
  type CustomEntity,
  type FieldType,
  type TagColor,
} from "@/modules/customization/constants";

type Db = TenantContext["db"];

type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
  showInTable: boolean;
  filterable: boolean;
  visibleWhen: unknown;
  position: number;
  isActive: boolean;
};

export function toFieldDef(r: FieldRow): FieldDef {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    type: r.type as FieldType,
    options: Array.isArray(r.options) ? (r.options as FieldOption[]) : [],
    required: r.required,
    showInTable: r.showInTable,
    filterable: r.filterable,
    visibleWhen: (r.visibleWhen as VisibleWhen) ?? null,
    position: r.position,
    isActive: r.isActive,
  };
}

/** Definisi custom field entitas, terurut. Tanpa pemeriksaan izin (dipakai internal oleh modul lain). */
export async function loadFieldDefs(
  db: Db,
  entity: CustomEntity,
  opts: { activeOnly?: boolean } = {},
): Promise<FieldDef[]> {
  const rows = await db.customFieldDefinition.findMany({
    where: { entityType: entity, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toFieldDef);
}

export async function listFieldDefs(
  ctx: TenantContext,
  entity: CustomEntity,
  opts: { activeOnly?: boolean } = {},
) {
  assertCan(ctx, "view", "CustomField");
  return loadFieldDefs(ctx.db, entity, opts);
}

export type TagDto = { id: string; name: string; color: TagColor };

export async function listTags(ctx: TenantContext) {
  assertCan(ctx, "view", "Tag");
  const rows = await ctx.db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { taggables: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color as TagColor,
    usage: t._count.taggables,
  }));
}

/** Tag per entitas untuk banyak id sekaligus (satu query, tanpa N+1). */
export async function tagsForEntities(
  ctx: TenantContext,
  entity: CustomEntity,
  ids: string[],
): Promise<Record<string, TagDto[]>> {
  const out: Record<string, TagDto[]> = {};
  if (!ids.length) return out;
  const rows = await ctx.db.taggable.findMany({
    where: { entityType: entity, entityId: { in: ids } },
    include: { tag: { select: { id: true, name: true, color: true } } },
    orderBy: { tag: { name: "asc" } },
  });
  for (const r of rows) {
    (out[r.entityId] ??= []).push({ ...r.tag, color: r.tag.color as TagColor });
  }
  return out;
}

export type ListingCustomization = {
  defs: FieldDef[];
  /** Kondisi Prisma tambahan (AND) dari filter tag + custom field di URL. */
  where: Record<string, unknown>[];
  tags: TagDto[];
};

/**
 * Siapkan kustomisasi untuk halaman daftar: definisi field, daftar tag, dan kondisi filter dari
 * query string (`tag=<id>`, `cf_<key>=<nilai>`). Hanya field `filterable` aktif yang diterapkan.
 */
export async function listingCustomization(
  ctx: TenantContext,
  entity: CustomEntity,
  get: (param: string) => string | undefined,
): Promise<ListingCustomization> {
  const [defs, tags] = await Promise.all([
    loadFieldDefs(ctx.db, entity, { activeOnly: true }),
    ctx.db.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);
  const where = customFieldWhere(defs, get);
  const tagId = get(TAG_PARAM);
  if (tagId && /^[0-9a-f-]{36}$/i.test(tagId)) {
    const links = await ctx.db.taggable.findMany({
      where: { entityType: entity, tagId },
      select: { entityId: true },
    });
    where.push({ id: { in: links.map((l) => l.entityId) } });
  }
  return { defs, where, tags: tags.map((t) => ({ ...t, color: t.color as TagColor })) };
}

// --- Saved views ---
export type SavedViewDto = {
  id: string;
  name: string;
  visibility: string;
  teamId: string | null;
  ownerId: string;
  isDefault: boolean;
  params: Record<string, string>;
  mine: boolean;
};

const toDto = (v: SavedView, userId: string): SavedViewDto => ({
  id: v.id,
  name: v.name,
  visibility: v.visibility,
  teamId: v.teamId,
  ownerId: v.ownerId,
  isDefault: v.isDefault,
  params: (v.params && typeof v.params === "object" ? v.params : {}) as Record<string, string>,
  mine: v.ownerId === userId,
});

/** Tampilan yang boleh dilihat user: miliknya, dibagikan ke organisasi, atau ke tim yang ia ikuti. */
export async function listSavedViews(
  ctx: TenantContext,
  entity: CustomEntity,
): Promise<SavedViewDto[]> {
  const myTeams = await ctx.db.teamMember.findMany({
    where: { userId: ctx.userId },
    select: { teamId: true },
  });
  const rows = await ctx.db.savedView.findMany({
    where: {
      entityType: entity,
      OR: [
        { ownerId: ctx.userId },
        { visibility: "organization" },
        { visibility: "team", teamId: { in: myTeams.map((t) => t.teamId) } },
      ],
    },
    orderBy: [{ name: "asc" }],
  });
  return rows.map((r) => toDto(r, ctx.userId));
}

/** View bawaan pengguna (default pribadi) untuk entitas, atau null. */
export async function getDefaultView(ctx: TenantContext, entity: CustomEntity) {
  const row = await ctx.db.savedView.findFirst({
    where: { entityType: entity, ownerId: ctx.userId, isDefault: true },
  });
  return row ? toDto(row, ctx.userId) : null;
}

/** Tag + nilai custom field satu record untuk halaman detail & default form edit. */
export async function getEntityCustomization(
  ctx: TenantContext,
  entity: CustomEntity,
  id: string,
  customFieldsJson: unknown,
) {
  const [defs, tagMap] = await Promise.all([
    loadFieldDefs(ctx.db, entity, { activeOnly: true }),
    tagsForEntities(ctx, entity, [id]),
  ]);
  const tags = tagMap[id] ?? [];
  const values =
    customFieldsJson && typeof customFieldsJson === "object" && !Array.isArray(customFieldsJson)
      ? (customFieldsJson as Record<string, unknown>)
      : {};
  return {
    defs,
    values,
    tags,
    formDefaults: { customFields: values, tagIds: tags.map((t) => t.id) },
  };
}

/** Data kustomisasi untuk tabel daftar: tag per baris (satu query) + definisi + semua tag. */
export async function buildListCustomization(
  ctx: TenantContext,
  entity: CustomEntity,
  cust: ListingCustomization,
  rows: { id: string }[],
) {
  return {
    entity,
    defs: cust.defs,
    allTags: cust.tags,
    rowTags: await tagsForEntities(
      ctx,
      entity,
      rows.map((r) => r.id),
    ),
  };
}

/** Terapkan view bawaan pengguna bila halaman dibuka tanpa parameter apa pun (`?all=1` = tampil semua). */
export async function defaultViewHref(
  ctx: TenantContext,
  entity: CustomEntity,
  sp: Record<string, string | string[] | undefined>,
  basePath: string,
): Promise<string | null> {
  if (Object.keys(sp).length > 0) return null;
  const view = await getDefaultView(ctx, entity);
  if (!view || Object.keys(view.params).length === 0) return null;
  return `${basePath}?${new URLSearchParams(view.params).toString()}`;
}

/** Data bar saved views untuk halaman daftar. */
export async function loadSavedViewsBar(ctx: TenantContext, entity: CustomEntity) {
  const [views, teams] = await Promise.all([
    listSavedViews(ctx, entity),
    ctx.db.team.findMany({
      where:
        ctx.role === "owner" || ctx.role === "admin"
          ? {}
          : { members: { some: { userId: ctx.userId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    entity,
    views,
    teams,
    canShareOrg: ["owner", "admin", "sales_manager"].includes(ctx.role),
  };
}
