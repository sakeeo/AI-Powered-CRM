import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const actions = await import("@/modules/customization/server/actions");
const q = await import("@/modules/customization/server/queries");
const leadActions = await import("@/modules/leads/server/actions");
const leadQ = await import("@/modules/leads/server/queries");
const contactActions = await import("@/modules/contacts/server/actions");
const importActions = await import("@/modules/import-export/server/actions");
const { buildDataset } = await import("@/modules/import-export/server/export");
const { LEAD_SORTS } = await import("@/modules/leads/constants");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const params = () => parseListParams({}, LEAD_SORTS, "createdAt");

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

const baseField = {
  options: [],
  required: false,
  showInTable: false,
  filterable: false,
  visibleWhen: null,
};

describe("Tags", () => {
  it("nama unik per organisasi (tanpa beda huruf), ubah & hapus ikut melepas dari data", async () => {
    await makeOrg("Org A");
    const t = idOf(await actions.createTag({ name: "VIP", color: "green" }));
    expect(await actions.createTag({ name: "vip", color: "blue" })).toMatchObject({ ok: false });
    const lead = idOf(await leadActions.createLead({ name: "Budi Santoso", tagIds: [t] }));
    expect((await q.tagsForEntities(await ctxNow(), "lead", [lead]))[lead]).toHaveLength(1);

    expect(await actions.updateTag({ id: t, name: "VIP Gold", color: "orange" })).toMatchObject({
      ok: true,
    });
    const tags = await q.listTags(await ctxNow());
    expect(tags[0]).toMatchObject({ name: "VIP Gold", color: "orange", usage: 1 });

    expect(await actions.deleteTag({ id: t })).toMatchObject({ ok: true });
    expect(await testPrisma.taggable.count()).toBe(0);
  });

  it("menetapkan & memfilter tag untuk lead, contact; update tanpa tagIds tidak menghapus tag", async () => {
    await makeOrg("Org A");
    const a = idOf(await actions.createTag({ name: "Hot", color: "red" }));
    const b = idOf(await actions.createTag({ name: "Partner", color: "blue" }));
    const l1 = idOf(await leadActions.createLead({ name: "Lead Satu", tagIds: [a, b] }));
    await leadActions.createLead({ name: "Lead Dua" });
    const c1 = idOf(await contactActions.createContact({ name: "Kontak Satu", tagIds: [a] }));

    // update tanpa tagIds → tag tetap
    await leadActions.updateLead({ id: l1, name: "Lead Satu Baru" });
    expect(await testPrisma.taggable.count({ where: { entityId: l1 } })).toBe(2);
    // update dengan tagIds → diganti
    await leadActions.updateLead({ id: l1, name: "Lead Satu Baru", tagIds: [b] });
    expect(
      (await testPrisma.taggable.findMany({ where: { entityId: l1 } })).map((x) => x.tagId),
    ).toEqual([b]);

    const ctx = await ctxNow();
    const cust = await q.listingCustomization(ctx, "lead", (k) => (k === "tag" ? b : undefined));
    const list = await leadQ.listLeads(ctx, params(), { extra: cust.where });
    expect(list.rows.map((r) => r.name)).toEqual(["Lead Satu Baru"]);

    expect(
      await actions.setEntityTags({ entityType: "contact", entityId: c1, tagIds: [a, b] }),
    ).toMatchObject({ ok: true, data: { added: 1, removed: 0 } });
  });

  it("tag organisasi lain ditolak; tag tidak terlihat lintas tenant", async () => {
    const a = await makeOrg("Org A");
    const tagA = idOf(await actions.createTag({ name: "Rahasia A", color: "red" }));
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const leadB = idOf(await leadActions.createLead({ name: "Lead B" }));
    expect(
      await leadActions.updateLead({ id: leadB, name: "Lead B", tagIds: [tagA] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.setEntityTags({ entityType: "lead", entityId: leadB, tagIds: [tagA] }),
    ).toMatchObject({ ok: false });
    expect(await q.listTags(await ctxNow())).toHaveLength(0);
    expect(await actions.updateTag({ id: tagA, name: "Dibajak", color: "blue" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteTag({ id: tagA })).toMatchObject({ ok: false });
    actAs(a.owner);
    expect((await q.listTags(await ctxNow()))[0].name).toBe("Rahasia A");
  });

  it("izin: viewer tidak bisa membuat tag; sales rep hanya bisa membuat; tidak bisa menghapus", async () => {
    const o = await makeOrg("Org A");
    const tag = idOf(await actions.createTag({ name: "Umum", color: "blue" }));
    const viewer = await addUserWithRole(o.orgId, "viewer", "Vi");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    actAs(viewer);
    expect(await actions.createTag({ name: "X", color: "blue" })).toMatchObject({ ok: false });
    actAs(rep);
    expect(await actions.createTag({ name: "Buatan Rep", color: "blue" })).toMatchObject({
      ok: true,
    });
    expect(await actions.updateTag({ id: tag, name: "Ubah", color: "blue" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteTag({ id: tag })).toMatchObject({ ok: false });
  });
});

describe("Custom fields", () => {
  it("definisi: kunci otomatis & unik, tipe tidak bisa diubah, opsi wajib untuk select", async () => {
    await makeOrg("Org A");
    const r1 = await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Ukuran Tim",
      type: "number",
    });
    expect(r1).toMatchObject({ ok: true, data: { key: "ukuran_tim" } });
    const r2 = await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Ukuran Tim",
      type: "text",
    });
    expect(r2).toMatchObject({ ok: true, data: { key: "ukuran_tim_2" } });
    expect(
      await actions.createCustomField({
        ...baseField,
        entityType: "lead",
        label: "Pilihan",
        type: "select",
      }),
    ).toMatchObject({ ok: false });
    const id = idOf(r1);
    expect(
      await actions.updateCustomField({
        ...baseField,
        id,
        label: "Ukuran Tim",
        type: "text",
        isActive: true,
      }),
    ).toMatchObject({ ok: false });
    // field sama boleh ada di entitas berbeda
    expect(
      await actions.createCustomField({
        ...baseField,
        entityType: "contact",
        label: "Ukuran Tim",
        type: "number",
      }),
    ).toMatchObject({ ok: true, data: { key: "ukuran_tim" } });
  });

  it("nilai tervalidasi per tipe di server; wajib; kondisi menyembunyikan & membuang nilai", async () => {
    await makeOrg("Org A");
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Tier",
      type: "select",
      options: [
        { value: "gold", label: "Gold" },
        { value: "silver", label: "Silver" },
      ],
      required: true,
    });
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Diskon Khusus",
      type: "number",
      required: true,
      visibleWhen: { fieldKey: "tier", op: "equals", value: "gold" },
    });

    expect(await leadActions.createLead({ name: "Tanpa Tier" })).toMatchObject({ ok: false });
    expect(
      await leadActions.createLead({ name: "Tier Salah", customFields: { tier: "platinum" } }),
    ).toMatchObject({ ok: false });
    // gold → diskon wajib
    expect(
      await leadActions.createLead({ name: "Gold Tanpa Diskon", customFields: { tier: "gold" } }),
    ).toMatchObject({ ok: false });
    expect(
      await leadActions.createLead({
        name: "Gold Diskon Salah",
        customFields: { tier: "gold", diskon_khusus: "banyak" },
      }),
    ).toMatchObject({ ok: false });
    const gold = idOf(
      await leadActions.createLead({
        name: "Gold Lengkap",
        customFields: { tier: "gold", diskon_khusus: "10" },
      }),
    );
    // silver → diskon tersembunyi: tidak wajib, nilai kiriman dibuang
    const silver = idOf(
      await leadActions.createLead({
        name: "Silver Saja",
        customFields: { tier: "silver", diskon_khusus: "99", injected: "x" },
      }),
    );
    const ctx = await ctxNow();
    expect((await leadQ.getLead(ctx, gold)).customFields).toEqual({
      tier: "gold",
      diskon_khusus: 10,
    });
    expect((await leadQ.getLead(ctx, silver)).customFields).toEqual({ tier: "silver" });
  });

  it("update: tanpa customFields tidak menghapus nilai; dengan customFields menggantinya", async () => {
    await makeOrg("Org A");
    await actions.createCustomField({
      ...baseField,
      entityType: "contact",
      label: "Kota Asal",
      type: "text",
    });
    const c = idOf(
      await contactActions.createContact({
        name: "Siti Aminah",
        customFields: { kota_asal: "Solo" },
      }),
    );
    await contactActions.updateContact({ id: c, name: "Siti Aminah Baru", companyIds: [] });
    expect((await testPrisma.contact.findUnique({ where: { id: c } }))!.customFields).toEqual({
      kota_asal: "Solo",
    });
    await contactActions.updateContact({
      id: c,
      name: "Siti Aminah Baru",
      companyIds: [],
      customFields: { kota_asal: "Medan" },
    });
    expect((await testPrisma.contact.findUnique({ where: { id: c } }))!.customFields).toEqual({
      kota_asal: "Medan",
    });
  });

  it("filter, kolom tabel, dan export memuat custom field + tag", async () => {
    await makeOrg("Org A");
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Segmen",
      type: "select",
      options: [
        { value: "ukm", label: "UKM" },
        { value: "korp", label: "Korporasi" },
      ],
      filterable: true,
      showInTable: true,
    });
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Catatan Sales",
      type: "text",
      filterable: true,
    });
    const tag = idOf(await actions.createTag({ name: "Prioritas", color: "red" }));
    await leadActions.createLead({
      name: "Lead UKM",
      customFields: { segmen: "ukm", catatan_sales: "=HYPERLINK(1)" },
      tagIds: [tag],
    });
    await leadActions.createLead({ name: "Lead Korp", customFields: { segmen: "korp" } });

    const ctx = await ctxNow();
    const get = (m: Record<string, string>) => (k: string) => m[k];
    const cust = await q.listingCustomization(ctx, "lead", get({ cf_segmen: "korp" }));
    const rows = (await leadQ.listLeads(ctx, params(), { extra: cust.where })).rows;
    expect(rows.map((r) => r.name)).toEqual(["Lead Korp"]);
    const text = await q.listingCustomization(ctx, "lead", get({ cf_catatan_sales: "HYPER" }));
    expect((await leadQ.listLeads(ctx, params(), { extra: text.where })).rows).toHaveLength(1);
    expect(cust.defs.filter((d) => d.showInTable).map((d) => d.key)).toEqual(["segmen"]);

    const ds = await buildDataset(ctx, "leads", { cf_segmen: "ukm" });
    expect(ds.columns.slice(-3)).toEqual(["Tag", "Segmen", "Catatan Sales"]);
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0].slice(-3)).toEqual(["Prioritas", "UKM", "'=HYPERLINK(1)"]);
  });

  it("import CSV: memetakan custom field, memvalidasi per baris, melaporkan error", async () => {
    await makeOrg("Org A");
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Segmen",
      type: "select",
      options: [{ value: "ukm", label: "UKM" }],
      required: true,
    });
    await actions.createCustomField({
      ...baseField,
      entityType: "lead",
      label: "Minat",
      type: "multiselect",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    const res = await importActions.importLeadsBatch({
      startRow: 2,
      rows: [
        { name: "Impor Satu", "cf:segmen": "ukm", "cf:minat": "a;b" },
        { name: "Impor Dua" },
        { name: "Impor Tiga", "cf:segmen": "lainnya" },
      ],
    });
    expect(res).toMatchObject({ ok: true, data: { created: 1 } });
    const errors = (res as { data: { errors: { row: number }[] } }).data.errors;
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
    const lead = await testPrisma.lead.findFirst({ where: { name: "Impor Satu" } });
    expect(lead!.customFields).toEqual({ segmen: "ukm", minat: ["a", "b"] });
  });

  it("izin & tenant: hanya admin/owner kelola; field tenant lain tidak bocor", async () => {
    const a = await makeOrg("Org A");
    const mgr = await addUserWithRole(a.orgId, "sales_manager", "Mgr");
    const admin = await addUserWithRole(a.orgId, "admin", "Adm");
    actAs(mgr);
    expect(
      await actions.createCustomField({
        ...baseField,
        entityType: "lead",
        label: "Dilarang",
        type: "text",
      }),
    ).toMatchObject({ ok: false });
    actAs(admin);
    const id = idOf(
      await actions.createCustomField({
        ...baseField,
        entityType: "lead",
        label: "Boleh",
        type: "text",
      }),
    );
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await q.listFieldDefs(await ctxNow(), "lead")).toHaveLength(0);
    expect(await actions.deleteCustomField({ id })).toMatchObject({ ok: false });
    expect(
      await actions.updateCustomField({
        ...baseField,
        id,
        label: "Dibajak",
        type: "text",
        isActive: true,
      }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.customFieldDefinition.count()).toBe(1);
  });

  it("tidak bisa menghapus field yang dipakai sebagai kondisi; siklus ditolak", async () => {
    await makeOrg("Org A");
    const base = idOf(
      await actions.createCustomField({
        ...baseField,
        entityType: "deal",
        label: "Jenis",
        type: "text",
      }),
    );
    const child = idOf(
      await actions.createCustomField({
        ...baseField,
        entityType: "deal",
        label: "Rincian",
        type: "text",
        visibleWhen: { fieldKey: "jenis", op: "filled" },
      }),
    );
    expect(await actions.deleteCustomField({ id: base })).toMatchObject({ ok: false });
    expect(
      await actions.updateCustomField({
        ...baseField,
        id: base,
        label: "Jenis",
        type: "text",
        isActive: true,
        visibleWhen: { fieldKey: "rincian", op: "filled" },
      }),
    ).toMatchObject({ ok: false });
    expect(await actions.deleteCustomField({ id: child })).toMatchObject({ ok: true });
    expect(await actions.deleteCustomField({ id: base })).toMatchObject({ ok: true });
  });
});

describe("Saved views", () => {
  it("pribadi hanya terlihat pemilik; tim untuk anggota tim; organisasi untuk semua", async () => {
    const o = await makeOrg("Org A");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const rep1 = await addUserWithRole(o.orgId, "sales_rep", "Rep1");
    const rep2 = await addUserWithRole(o.orgId, "sales_rep", "Rep2");
    const team = await testPrisma.team.create({
      data: { organizationId: o.orgId, name: "Tim Jawa" },
    });
    await testPrisma.teamMember.createMany({
      data: [
        { organizationId: o.orgId, teamId: team.id, userId: mgr.id },
        { organizationId: o.orgId, teamId: team.id, userId: rep1.id },
      ],
    });

    actAs(mgr);
    await actions.createSavedView({
      entityType: "lead",
      name: "Pribadi Mgr",
      visibility: "personal",
      params: { status: "new" },
    });
    await actions.createSavedView({
      entityType: "lead",
      name: "Tim Jawa",
      visibility: "team",
      teamId: team.id,
      params: { status: "qualified", page: "3", sort: "name" },
    });
    await actions.createSavedView({
      entityType: "lead",
      name: "Semua Orang",
      visibility: "organization",
      params: { owner: "unassigned" },
    });
    const names = async (u: Parameters<typeof actAs>[0]) => {
      actAs(u);
      return (await q.listSavedViews(await ctxNow(), "lead")).map((v) => v.name).sort();
    };
    expect(await names(mgr)).toEqual(["Pribadi Mgr", "Semua Orang", "Tim Jawa"]);
    expect(await names(rep1)).toEqual(["Semua Orang", "Tim Jawa"]);
    expect(await names(rep2)).toEqual(["Semua Orang"]);
    expect(await names(mgr)).not.toContain("Lain");

    // parameter `page` tidak disimpan
    const stored = await testPrisma.savedView.findFirst({ where: { name: "Tim Jawa" } });
    expect(stored!.params).toEqual({ status: "qualified", sort: "name" });

    // view entitas lain tidak tercampur
    actAs(mgr);
    expect(await q.listSavedViews(await ctxNow(), "contact")).toHaveLength(0);
  });

  it("aturan berbagi: rep tidak bisa membagikan ke organisasi atau tim yang bukan miliknya", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const team = await testPrisma.team.create({
      data: { organizationId: o.orgId, name: "Tim Lain" },
    });
    actAs(rep);
    expect(
      await actions.createSavedView({
        entityType: "lead",
        name: "Org",
        visibility: "organization",
        params: {},
      }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createSavedView({
        entityType: "lead",
        name: "Tim",
        visibility: "team",
        teamId: team.id,
        params: {},
      }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createSavedView({
        entityType: "lead",
        name: "Tim tanpa id",
        visibility: "team",
        params: {},
      }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createSavedView({
        entityType: "lead",
        name: "Pribadi",
        visibility: "personal",
        params: {},
      }),
    ).toMatchObject({ ok: true });
  });

  it("hanya pemilik (atau admin) yang boleh mengubah/menghapus; bawaan hanya satu per entitas", async () => {
    const o = await makeOrg("Org A");
    const rep1 = await addUserWithRole(o.orgId, "sales_rep", "Rep1");
    const rep2 = await addUserWithRole(o.orgId, "sales_rep", "Rep2");
    actAs(rep1);
    const v1 = idOf(
      await actions.createSavedView({
        entityType: "lead",
        name: "V Satu",
        visibility: "personal",
        params: { status: "new" },
        isDefault: true,
      }),
    );
    const v2 = idOf(
      await actions.createSavedView({
        entityType: "lead",
        name: "V Dua",
        visibility: "personal",
        params: { status: "contacted" },
        isDefault: true,
      }),
    );
    expect((await testPrisma.savedView.findUnique({ where: { id: v1 } }))!.isDefault).toBe(false);
    expect((await q.getDefaultView(await ctxNow(), "lead"))!.id).toBe(v2);

    actAs(rep2);
    expect(await actions.deleteSavedView({ id: v1 })).toMatchObject({ ok: false });
    expect(await actions.updateSavedView({ id: v1, name: "Dibajak" })).toMatchObject({ ok: false });
    actAs(o.owner);
    expect(await actions.deleteSavedView({ id: v1 })).toMatchObject({ ok: true });
    actAs(rep1);
    expect(await actions.deleteSavedView({ id: v2 })).toMatchObject({ ok: true });
    expect(await q.getDefaultView(await ctxNow(), "lead")).toBeNull();
  });

  it("view organisasi lain tidak terlihat atau dapat dihapus", async () => {
    const a = await makeOrg("Org A");
    const v = idOf(
      await actions.createSavedView({
        entityType: "lead",
        name: "A saja",
        visibility: "organization",
        params: {},
      }),
    );
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await q.listSavedViews(await ctxNow(), "lead")).toHaveLength(0);
    expect(await actions.deleteSavedView({ id: v })).toMatchObject({ ok: false });
    expect(await testPrisma.savedView.count()).toBe(1);
    actAs(a.owner);
    expect(await q.listSavedViews(await ctxNow(), "lead")).toHaveLength(1);
  });

  it("defaultViewHref hanya aktif bila halaman dibuka tanpa parameter", async () => {
    await makeOrg("Org A");
    await actions.createSavedView({
      entityType: "lead",
      name: "Bawaan",
      visibility: "personal",
      params: { status: "qualified" },
      isDefault: true,
    });
    const ctx = await ctxNow();
    expect(await q.defaultViewHref(ctx, "lead", {}, "/leads")).toBe("/leads?status=qualified");
    expect(await q.defaultViewHref(ctx, "lead", { all: "1" }, "/leads")).toBeNull();
    expect(await q.defaultViewHref(ctx, "contact", {}, "/contacts")).toBeNull();
  });
});
