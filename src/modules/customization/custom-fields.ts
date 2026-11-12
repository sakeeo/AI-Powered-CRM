import {
  CF_PARAM_PREFIX,
  type ConditionOp,
  type FieldType,
} from "@/modules/customization/constants";

/** Logika murni custom field (tanpa dependensi server) — dipakai server, form, dan test. */

export type FieldOption = { value: string; label: string };
export type VisibleWhen = { fieldKey: string; op: ConditionOp; value?: string } | null;

export type FieldDef = {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  options: FieldOption[];
  required: boolean;
  showInTable: boolean;
  filterable: boolean;
  visibleWhen: VisibleWhen;
  position: number;
  isActive: boolean;
};

export type CustomValues = Record<string, unknown>;

/** Slug stabil untuk kunci field dari label: huruf kecil, angka, underscore. */
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Apakah nilai (dari form) dianggap "terisi" untuk kondisi. */
function asComparable(v: unknown): string {
  if (Array.isArray(v)) return v.join(",");
  if (typeof v === "boolean") return v ? "true" : "false";
  return v === undefined || v === null ? "" : String(v);
}

/** Evaluasi conditional logic: field tampil bila kondisi terpenuhi (atau tanpa kondisi). */
export function isFieldVisible(def: Pick<FieldDef, "visibleWhen">, values: CustomValues): boolean {
  const c = def.visibleWhen;
  if (!c) return true;
  const current = values[c.fieldKey];
  switch (c.op) {
    case "filled":
      return !isEmpty(current);
    case "empty":
      return isEmpty(current);
    case "equals":
      return Array.isArray(current)
        ? current.map(String).includes(c.value ?? "")
        : asComparable(current) === (c.value ?? "");
    case "not_equals":
      return Array.isArray(current)
        ? !current.map(String).includes(c.value ?? "")
        : asComparable(current) !== (c.value ?? "");
  }
}

/** Daftar field yang tampil untuk nilai saat ini; field induk yang tersembunyi ikut menyembunyikan turunannya. */
export function visibleFields(defs: FieldDef[], values: CustomValues): FieldDef[] {
  const active = defs.filter((d) => d.isActive).sort((a, b) => a.position - b.position);
  const hidden = new Set<string>();
  // Iterasi sampai stabil agar rantai kondisi (A → B → C) konsisten.
  for (let pass = 0; pass <= active.length; pass++) {
    let changed = false;
    for (const d of active) {
      if (hidden.has(d.key)) continue;
      const parent = d.visibleWhen?.fieldKey;
      const parentHidden = parent ? hidden.has(parent) : false;
      const effective = Object.fromEntries(Object.entries(values).filter(([k]) => !hidden.has(k)));
      if (parentHidden || !isFieldVisible(d, effective)) {
        hidden.add(d.key);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return active.filter((d) => !hidden.has(d.key));
}

export type ValidationResult = {
  values: CustomValues;
  errors: Record<string, string>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(
  def: FieldDef,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const label = def.label;
  switch (def.type) {
    case "text":
    case "textarea": {
      const s = String(raw).trim();
      const max = def.type === "text" ? 255 : 5000;
      if (s.length > max) return { ok: false, error: `${label}: maksimal ${max} karakter` };
      return { ok: true, value: s };
    }
    case "url": {
      const s = String(raw).trim();
      if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s))
        return {
          ok: false,
          error: `${label}: URL tidak valid (awali dengan http:// atau https://)`,
        };
      if (s.length > 500) return { ok: false, error: `${label}: maksimal 500 karakter` };
      return { ok: true, value: s };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) return { ok: false, error: `${label}: harus berupa angka` };
      return { ok: true, value: n };
    }
    case "date": {
      const s = String(raw);
      const d = new Date(`${s}T00:00:00Z`);
      if (!DATE_RE.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s)
        return { ok: false, error: `${label}: tanggal tidak valid (YYYY-MM-DD)` };
      return { ok: true, value: s };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === "ya" || raw === "1") return { ok: true, value: true };
      if (raw === "false" || raw === "tidak" || raw === "0") return { ok: true, value: false };
      return { ok: false, error: `${label}: harus Ya atau Tidak` };
    }
    case "select": {
      const s = String(raw);
      if (!def.options.some((o) => o.value === s))
        return { ok: false, error: `${label}: pilihan tidak valid` };
      return { ok: true, value: s };
    }
    case "multiselect": {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const allowed = new Set(def.options.map((o) => o.value));
      if (arr.some((v) => !allowed.has(v)))
        return { ok: false, error: `${label}: pilihan tidak valid` };
      return { ok: true, value: Array.from(new Set(arr)) };
    }
  }
}

/**
 * Validasi nilai custom field terhadap definisi (tipe, opsi, wajib, kondisi).
 * - Field tersembunyi oleh kondisi: nilai dibuang dan tidak wajib.
 * - Kunci tak dikenal dibuang (tidak pernah menyimpan input sembarang).
 * - `existing`: nilai yang sudah ada; kunci milik field nonaktif dipertahankan.
 */
export function validateCustomValues(
  defs: FieldDef[],
  raw: CustomValues | null | undefined,
  existing: CustomValues = {},
): ValidationResult {
  const input = raw ?? {};
  const shown = visibleFields(defs, input);
  const values: CustomValues = {};
  const errors: Record<string, string> = {};

  for (const d of defs) {
    if (!d.isActive && d.key in existing) values[d.key] = existing[d.key];
  }
  for (const d of shown) {
    const v = input[d.key];
    if (isEmpty(v) || (d.type === "boolean" && v === undefined)) {
      if (d.required && d.type !== "boolean") errors[d.key] = `${d.label} wajib diisi`;
      continue;
    }
    const res = coerce(d, v);
    if (res.ok) values[d.key] = res.value;
    else errors[d.key] = res.error;
  }
  return { values, errors };
}

/** Teks tampilan/export untuk satu nilai. */
export function formatCustomValue(def: FieldDef, value: unknown): string {
  if (isEmpty(value)) return "";
  const label = (v: string) => def.options.find((o) => o.value === v)?.label ?? v;
  switch (def.type) {
    case "boolean":
      return value === true ? "Ya" : "Tidak";
    case "select":
      return label(String(value));
    case "multiselect":
      return (Array.isArray(value) ? value : [value]).map((v) => label(String(v))).join("; ");
    case "date": {
      const [y, m, d] = String(value).split("-");
      return y && m && d ? `${d}/${m}/${y}` : String(value);
    }
    case "number":
      return String(value);
    default:
      return String(value);
  }
}

/** Ambil objek nilai dari kolom JSON (aman terhadap nilai null/array/primitif). */
export function readValues(json: unknown): CustomValues {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as CustomValues) : {};
}

/**
 * Filter Prisma JSON untuk parameter URL `cf_<key>=<nilai>` pada field `filterable`.
 * Parameter untuk key yang tidak dikenal/tidak filterable diabaikan.
 */
export function customFieldWhere(
  defs: FieldDef[],
  get: (param: string) => string | undefined,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const d of defs) {
    if (!d.isActive || !d.filterable) continue;
    const v = get(`${CF_PARAM_PREFIX}${d.key}`);
    if (v === undefined || v === "") continue;
    const path = [d.key];
    switch (d.type) {
      case "text":
      case "textarea":
      case "url":
        out.push({ customFields: { path, string_contains: v } });
        break;
      case "number": {
        const n = Number(v);
        if (Number.isFinite(n)) out.push({ customFields: { path, equals: n } });
        break;
      }
      case "boolean":
        out.push({ customFields: { path, equals: v === "true" } });
        break;
      case "date":
        out.push({ customFields: { path, equals: v } });
        break;
      case "select":
        out.push({ customFields: { path, equals: v } });
        break;
      case "multiselect":
        out.push({ customFields: { path, array_contains: [v] } });
        break;
    }
  }
  return out;
}

/** Cek referensi kondisi: field induk harus ada, bukan dirinya sendiri, dan tidak membentuk siklus. */
export function validateConditionGraph(
  defs: Pick<FieldDef, "key" | "visibleWhen">[],
): string | null {
  const keys = new Set(defs.map((d) => d.key));
  for (const d of defs) {
    const c = d.visibleWhen;
    if (!c) continue;
    if (c.fieldKey === d.key) return "Kondisi tidak boleh merujuk ke field itu sendiri";
    if (!keys.has(c.fieldKey)) return "Field acuan kondisi tidak ditemukan";
  }
  const parent = new Map(defs.map((d) => [d.key, d.visibleWhen?.fieldKey]));
  for (const d of defs) {
    const seen = new Set<string>();
    let cur: string | undefined = d.key;
    while (cur) {
      if (seen.has(cur)) return "Kondisi membentuk siklus antar field";
      seen.add(cur);
      cur = parent.get(cur);
    }
  }
  return null;
}
