import { z } from "zod";
import { optionalText } from "@/lib/schema-helpers";
import {
  CONDITION_OPS,
  CUSTOM_ENTITIES,
  FIELD_TYPES,
  MAX_FIELDS_PER_ENTITY,
  TAG_COLORS,
  VIEW_ENTITIES,
  VIEW_VISIBILITIES,
} from "@/modules/customization/constants";
import { KEY_PATTERN } from "@/modules/customization/custom-fields";

/** Bagian yang ditambahkan ke skema form entitas (lead/contact/company/deal). */
export const customizationFields = {
  /** Tidak dikirim = tidak diubah (jalur lain seperti import/merge tidak menghapus nilai). */
  customFields: z.record(z.string(), z.unknown()).optional(),
  tagIds: z.array(z.uuid()).max(30).optional(),
};

// --- Tags ---
export const tagSchema = z.object({
  name: z.string().trim().min(1, "Nama tag wajib diisi").max(40, "Maksimal 40 karakter"),
  color: z.enum(TAG_COLORS).default("blue"),
});
export const updateTagSchema = tagSchema.extend({ id: z.uuid() });

export const setEntityTagsSchema = z.object({
  entityType: z.enum(CUSTOM_ENTITIES),
  entityId: z.uuid(),
  tagIds: z.array(z.uuid()).max(30),
});

// --- Custom field definitions ---
const optionSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[^\s].*$/, "Nilai opsi tidak valid"),
  label: z.string().trim().min(1, "Label opsi wajib diisi").max(80),
});

const visibleWhenSchema = z
  .object({
    fieldKey: z.string().regex(KEY_PATTERN),
    op: z.enum(CONDITION_OPS),
    value: z.string().max(100).optional(),
  })
  .refine((c) => (c.op === "equals" || c.op === "not_equals" ? !!c.value : true), {
    path: ["value"],
    message: "Nilai pembanding wajib diisi",
  })
  .nullable();

const fieldBase = z.object({
  label: z.string().trim().min(2, "Label minimal 2 karakter").max(60),
  type: z.enum(FIELD_TYPES),
  options: z.array(optionSchema).max(50).default([]),
  required: z.boolean().default(false),
  showInTable: z.boolean().default(false),
  filterable: z.boolean().default(false),
  visibleWhen: visibleWhenSchema.default(null),
});

function checkOptions(
  v: { type: (typeof FIELD_TYPES)[number]; options: { value: string }[] },
  ctx: z.RefinementCtx,
) {
  const needs = v.type === "select" || v.type === "multiselect";
  if (needs && v.options.length === 0)
    ctx.addIssue({ code: "custom", path: ["options"], message: "Tambahkan minimal satu opsi" });
  const values = v.options.map((o) => o.value);
  if (new Set(values).size !== values.length)
    ctx.addIssue({ code: "custom", path: ["options"], message: "Nilai opsi harus unik" });
}

export const createFieldSchema = fieldBase
  .extend({
    entityType: z.enum(CUSTOM_ENTITIES),
    key: z
      .string()
      .regex(KEY_PATTERN, "Kunci: huruf kecil/angka/underscore, diawali huruf")
      .optional(),
  })
  .superRefine(checkOptions);

export const updateFieldSchema = fieldBase
  .extend({ id: z.uuid(), isActive: z.boolean().default(true) })
  .superRefine(checkOptions);

export const reorderFieldsSchema = z.object({
  entityType: z.enum(CUSTOM_ENTITIES),
  ids: z.array(z.uuid()).min(1).max(MAX_FIELDS_PER_ENTITY),
});

// --- Saved views ---
export const savedViewSchema = z.object({
  entityType: z.enum(VIEW_ENTITIES),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  visibility: z.enum(VIEW_VISIBILITIES).default("personal"),
  teamId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.uuid().optional()),
  /** Query string (tanpa halaman) — hanya parameter yang diizinkan, divalidasi ulang di server. */
  params: z.record(z.string(), z.string().max(200)).default({}),
  isDefault: z.boolean().default(false),
});
export const updateSavedViewSchema = z.object({
  id: z.uuid(),
  name: optionalText(60),
  visibility: z.enum(VIEW_VISIBILITIES).optional(),
  teamId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.uuid().optional()),
  isDefault: z.boolean().optional(),
});
