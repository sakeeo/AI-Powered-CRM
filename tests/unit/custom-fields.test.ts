import { describe, expect, it } from "vitest";
import {
  customFieldWhere,
  formatCustomValue,
  isFieldVisible,
  slugifyKey,
  validateConditionGraph,
  validateCustomValues,
  visibleFields,
  type FieldDef,
} from "@/modules/customization/custom-fields";

const def = (over: Partial<FieldDef> & Pick<FieldDef, "key" | "type">): FieldDef => ({
  label: over.key,
  options: [],
  required: false,
  showInTable: false,
  filterable: false,
  visibleWhen: null,
  position: 0,
  isActive: true,
  ...over,
});

const opts = [
  { value: "a", label: "Opsi A" },
  { value: "b", label: "Opsi B" },
];

describe("slugifyKey", () => {
  it("membuat kunci aman dari label", () => {
    expect(slugifyKey("Nomor NPWP Perusahaan!")).toBe("nomor_npwp_perusahaan");
    expect(slugifyKey("  Ukuran   Tim - Besar ")).toBe("ukuran_tim_besar");
  });
});

describe("validateCustomValues — tipe", () => {
  const defs = [
    def({ key: "t", type: "text" }),
    def({ key: "n", type: "number" }),
    def({ key: "d", type: "date" }),
    def({ key: "b", type: "boolean" }),
    def({ key: "s", type: "select", options: opts }),
    def({ key: "m", type: "multiselect", options: opts }),
    def({ key: "u", type: "url" }),
  ];

  it("menerima nilai valid dan menormalkan tipe", () => {
    const { values, errors } = validateCustomValues(defs, {
      t: "  halo ",
      n: "12,5",
      d: "2026-02-28",
      b: "true",
      s: "a",
      m: ["a", "b", "a"],
      u: "https://contoh.id/x",
    });
    expect(errors).toEqual({});
    expect(values).toEqual({
      t: "halo",
      n: 12.5,
      d: "2026-02-28",
      b: true,
      s: "a",
      m: ["a", "b"],
      u: "https://contoh.id/x",
    });
  });

  it("menolak angka, tanggal, pilihan, dan URL yang salah", () => {
    const { errors } = validateCustomValues(defs, {
      n: "abc",
      d: "2026-02-30",
      s: "zzz",
      m: ["a", "x"],
      u: "javascript:alert(1)",
    });
    expect(Object.keys(errors).sort()).toEqual(["d", "m", "n", "s", "u"]);
  });

  it("membuang kunci tak dikenal dan menjaga nilai field nonaktif", () => {
    const withInactive = [...defs, def({ key: "old", type: "text", isActive: false })];
    const { values } = validateCustomValues(
      withInactive,
      { t: "x", hacker: "1", old: "baru" },
      {
        old: "lama",
      },
    );
    expect(values).toEqual({ t: "x", old: "lama" });
  });
});

describe("field wajib & conditional logic", () => {
  const defs = [
    def({ key: "tipe", type: "select", options: opts, position: 0 }),
    def({
      key: "alasan",
      type: "text",
      required: true,
      position: 1,
      visibleWhen: { fieldKey: "tipe", op: "equals", value: "b" },
    }),
    def({
      key: "detail",
      type: "text",
      position: 2,
      visibleWhen: { fieldKey: "alasan", op: "filled" },
    }),
  ];

  it("field bersyarat tersembunyi: tidak wajib dan nilainya dibuang", () => {
    const r = validateCustomValues(defs, { tipe: "a", alasan: "sisa", detail: "x" });
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ tipe: "a" });
  });

  it("field bersyarat tampil: wajib diisi", () => {
    expect(validateCustomValues(defs, { tipe: "b" }).errors.alasan).toMatch(/wajib/);
    const ok = validateCustomValues(defs, { tipe: "b", alasan: "mahal", detail: "ok" });
    expect(ok.errors).toEqual({});
    expect(ok.values).toEqual({ tipe: "b", alasan: "mahal", detail: "ok" });
  });

  it("rantai kondisi: induk tersembunyi menyembunyikan turunan", () => {
    expect(visibleFields(defs, { tipe: "a", alasan: "x" }).map((d) => d.key)).toEqual(["tipe"]);
    expect(visibleFields(defs, { tipe: "b", alasan: "x" }).map((d) => d.key)).toEqual([
      "tipe",
      "alasan",
      "detail",
    ]);
  });

  it("operator equals/not_equals/filled/empty", () => {
    const v = { visibleWhen: { fieldKey: "k", op: "not_equals", value: "x" } } as const;
    expect(isFieldVisible(v, { k: "y" })).toBe(true);
    expect(isFieldVisible(v, { k: "x" })).toBe(false);
    expect(isFieldVisible({ visibleWhen: { fieldKey: "k", op: "empty" } }, {})).toBe(true);
    expect(isFieldVisible({ visibleWhen: { fieldKey: "k", op: "filled" } }, { k: [] })).toBe(false);
    expect(
      isFieldVisible({ visibleWhen: { fieldKey: "k", op: "equals", value: "true" } }, { k: true }),
    ).toBe(true);
  });

  it("graf kondisi menolak siklus, acuan diri sendiri, dan acuan tak dikenal", () => {
    const c = (k: string, f?: string) => ({
      key: k,
      visibleWhen: f ? ({ fieldKey: f, op: "filled" } as const) : null,
    });
    expect(validateConditionGraph([c("a"), c("b", "a")])).toBeNull();
    expect(validateConditionGraph([c("a", "a")])).toMatch(/sendiri/);
    expect(validateConditionGraph([c("a", "b"), c("b", "a")])).toMatch(/siklus/);
    expect(validateConditionGraph([c("a", "zzz")])).toMatch(/tidak ditemukan/);
  });
});

describe("format & filter", () => {
  it("memformat nilai untuk tampilan/export", () => {
    expect(formatCustomValue(def({ key: "b", type: "boolean" }), true)).toBe("Ya");
    expect(formatCustomValue(def({ key: "s", type: "select", options: opts }), "a")).toBe("Opsi A");
    expect(
      formatCustomValue(def({ key: "m", type: "multiselect", options: opts }), ["a", "b"]),
    ).toBe("Opsi A; Opsi B");
    expect(formatCustomValue(def({ key: "d", type: "date" }), "2026-03-09")).toBe("09/03/2026");
    expect(formatCustomValue(def({ key: "t", type: "text" }), undefined)).toBe("");
  });

  it("customFieldWhere hanya memakai field aktif & filterable", () => {
    const defs = [
      def({ key: "kota", type: "text", filterable: true }),
      def({ key: "tier", type: "select", options: opts, filterable: true }),
      def({ key: "n", type: "number", filterable: true }),
      def({ key: "rahasia", type: "text", filterable: false }),
      def({ key: "lama", type: "text", filterable: true, isActive: false }),
    ];
    const params: Record<string, string> = {
      cf_kota: "jak",
      cf_tier: "a",
      cf_n: "5",
      cf_rahasia: "x",
      cf_lama: "y",
    };
    const where = customFieldWhere(defs, (k) => params[k]);
    expect(where).toEqual([
      { customFields: { path: ["kota"], string_contains: "jak" } },
      { customFields: { path: ["tier"], equals: "a" } },
      { customFields: { path: ["n"], equals: 5 } },
    ]);
  });
});
