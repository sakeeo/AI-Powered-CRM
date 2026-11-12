/** Entitas yang mendukung tags & custom fields (plan 2.1). */
export const CUSTOM_ENTITIES = ["lead", "contact", "company", "deal"] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

export const ENTITY_LABEL: Record<CustomEntity, string> = {
  lead: "Lead",
  contact: "Contact",
  company: "Company",
  deal: "Deal",
};

/** Subjek izin untuk record tiap entitas. */
export const ENTITY_SUBJECT = {
  lead: "Lead",
  contact: "Contact",
  company: "Company",
  deal: "Deal",
} as const;

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "url",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Teks",
  textarea: "Teks panjang",
  number: "Angka",
  date: "Tanggal",
  boolean: "Ya / Tidak",
  select: "Pilihan tunggal",
  multiselect: "Pilihan ganda",
  url: "URL",
};

export const CONDITION_OPS = ["equals", "not_equals", "filled", "empty"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];
export const CONDITION_OP_LABEL: Record<ConditionOp, string> = {
  equals: "sama dengan",
  not_equals: "tidak sama dengan",
  filled: "terisi",
  empty: "kosong",
};

export const MAX_FIELDS_PER_ENTITY = 40;

/** Palet tag → tone badge (src/components/shared/tone.ts). */
export const TAG_COLORS = ["blue", "green", "orange", "red", "purple"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** Tabel yang mendukung saved view (sama dengan entitas kustomisasi). */
export const VIEW_ENTITIES = CUSTOM_ENTITIES;
export const VIEW_VISIBILITIES = ["personal", "team", "organization"] as const;
export type ViewVisibility = (typeof VIEW_VISIBILITIES)[number];
export const VIEW_VISIBILITY_LABEL: Record<ViewVisibility, string> = {
  personal: "Pribadi",
  team: "Tim",
  organization: "Seluruh organisasi",
};

/** Prefix parameter URL untuk filter custom field. */
export const CF_PARAM_PREFIX = "cf_";
/** Parameter URL untuk filter tag. */
export const TAG_PARAM = "tag";
