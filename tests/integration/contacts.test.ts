import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const contactActions = await import("@/modules/contacts/server/actions");
const companyActions = await import("@/modules/companies/server/actions");
const contactQ = await import("@/modules/contacts/server/queries");
const companyQ = await import("@/modules/companies/server/queries");
const { CONTACT_SORTS, COMPANY_SORTS } = await import("@/modules/contacts/schemas");

const listParams = (sp = {}) => parseListParams(sp, CONTACT_SORTS, "createdAt");
const idOf = <T extends { ok: boolean }>(r: T) =>
  (r as unknown as { data: { id: string } }).data.id;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Company CRUD", () => {
  it("membuat, membaca, mengubah, menghapus (soft) + audit", async () => {
    const { orgId } = await makeOrg("Org A");
    const created = await companyActions.createCompany({
      name: "PT Maju",
      website: "maju.co.id",
      email: "Info@Maju.co.id",
    });
    expect(created.ok).toBe(true);
    const id = idOf(created);
    const ctx = (await getTenantContext())!;

    const company = await companyQ.getCompany(ctx, id);
    expect(company.email).toBe("info@maju.co.id");
    expect(company.organizationId).toBe(orgId);

    expect(
      (await companyActions.updateCompany({ id, name: "PT Maju Jaya", industry: "Retail" })).ok,
    ).toBe(true);
    expect((await companyQ.getCompany(ctx, id)).name).toBe("PT Maju Jaya");

    expect((await companyActions.deleteCompany({ id })).ok).toBe(true);
    await expect(companyQ.getCompany(ctx, id)).rejects.toMatchObject({ status: 404 });
    expect(
      (await testPrisma.company.findUniqueOrThrow({ where: { id } })).deletedAt,
    ).not.toBeNull();
    expect(await testPrisma.auditLog.count({ where: { entityType: "Company" } })).toBe(3);
  });

  it("validasi input", async () => {
    await makeOrg("Org A");
    expect(await companyActions.createCompany({ name: "x" })).toMatchObject({ ok: false });
    expect(
      await companyActions.createCompany({ name: "PT Valid", email: "bukan-email" }),
    ).toMatchObject({ ok: false });
    expect(await companyActions.createCompany({ name: "PT Valid", phone: "abc" })).toMatchObject({
      ok: false,
    });
  });
});

describe("Contact CRUD & relasi company", () => {
  it("contact terhubung ke beberapa company; update mengganti relasi; primary = pertama", async () => {
    await makeOrg("Org A");
    const c1 = idOf(await companyActions.createCompany({ name: "PT Satu" }));
    const c2 = idOf(await companyActions.createCompany({ name: "PT Dua" }));
    const created = await contactActions.createContact({
      name: "Budi",
      email: "budi@x.com",
      phone: "+62 812-3456-7890",
      companyIds: [c1, c2],
    });
    expect(created.ok).toBe(true);
    const id = idOf(created);
    const ctx = (await getTenantContext())!;

    let contact = await contactQ.getContact(ctx, id);
    expect(contact.companies.map((c) => c.company.name).sort()).toEqual(["PT Dua", "PT Satu"]);
    expect(contact.companies[0].isPrimary).toBe(true);

    // company menampilkan banyak contact (CONT-04)
    await contactActions.createContact({ name: "Sari", companyIds: [c1] });
    const company = await companyQ.getCompany(ctx, c1);
    expect(company.contacts.map((c) => c.contact.name).sort()).toEqual(["Budi", "Sari"]);

    expect((await contactActions.updateContact({ id, name: "Budi S", companyIds: [c2] })).ok).toBe(
      true,
    );
    contact = await contactQ.getContact(ctx, id);
    expect(contact.name).toBe("Budi S");
    expect(contact.companies.map((c) => c.company.name)).toEqual(["PT Dua"]);

    expect((await contactActions.deleteContact({ id })).ok).toBe(true);
    await expect(contactQ.getContact(ctx, id)).rejects.toMatchObject({ status: 404 });
  });

  it("menolak relasi ke company yang tidak ada / milik tenant lain", async () => {
    const a = await makeOrg("Org A");
    const foreign = idOf(await companyActions.createCompany({ name: "PT Milik A" }));
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const res = await contactActions.createContact({ name: "Intruder", companyIds: [foreign] });
    expect(res).toMatchObject({ ok: false });
    expect(await testPrisma.contact.count({ where: { organizationId: b.orgId } })).toBe(0);
    expect(a.orgId).not.toBe(b.orgId);
  });

  it("pencarian, sorting, filter owner, dan pagination dilakukan di server", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const other = await addUserWithRole(orgId, "sales_manager", "Mgr");
    for (let i = 1; i <= 25; i++) {
      await contactActions.createContact({
        name: `Kontak ${String(i).padStart(2, "0")}`,
        email: i === 7 ? "unik@target.com" : `k${i}@example.com`,
        ownerId: i % 5 === 0 ? other.id : owner.id,
      });
    }
    const ctx = (await getTenantContext())!;

    const p1 = await contactQ.listContacts(ctx, listParams({ sort: "name", dir: "asc" }));
    expect(p1.total).toBe(25);
    expect(p1.rows).toHaveLength(20);
    expect(p1.rows[0].name).toBe("Kontak 01");
    const p2 = await contactQ.listContacts(
      ctx,
      listParams({ sort: "name", dir: "asc", page: "2" }),
    );
    expect(p2.rows.map((r) => r.name)).toEqual([
      "Kontak 21",
      "Kontak 22",
      "Kontak 23",
      "Kontak 24",
      "Kontak 25",
    ]);

    const desc = await contactQ.listContacts(ctx, listParams({ sort: "name", dir: "desc" }));
    expect(desc.rows[0].name).toBe("Kontak 25");

    const search = await contactQ.listContacts(ctx, listParams({ q: "UNIK@target" }));
    expect(search.rows.map((r) => r.name)).toEqual(["Kontak 07"]);

    const byOwner = await contactQ.listContacts(ctx, listParams(), { ownerId: other.id });
    expect(byOwner.total).toBe(5);

    // sort tidak di-whitelist jatuh ke default (tidak error/injeksi)
    const bad = await contactQ.listContacts(
      ctx,
      listParams({ sort: "organizationId; DROP TABLE" }),
    );
    expect(bad.total).toBe(25);
  });
});

describe("izin & kepemilikan", () => {
  it("viewer hanya baca; sales rep hanya mengubah/menghapus miliknya & otomatis menjadi owner", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const ownerContact = idOf(await contactActions.createContact({ name: "Milik Owner" }));
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");

    actAs(viewer);
    expect(await contactActions.createContact({ name: "Coba Viewer" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect(await contactQ.listContacts((await getTenantContext())!, listParams())).toMatchObject({
      total: 1,
    });

    actAs(rep);
    // rep melihat data bersama tapi tidak boleh mengubah milik orang lain
    expect(
      await contactActions.updateContact({ id: ownerContact, name: "Diretas", companyIds: [] }),
    ).toEqual({ ok: false, error: "Akses ditolak" });
    expect(await contactActions.deleteContact({ id: ownerContact })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    const mine = await contactActions.createContact({ name: "Milik Rep", ownerId: owner.id }); // upaya menugaskan ke owner diabaikan
    const mineId = idOf(mine);
    expect((await testPrisma.contact.findUniqueOrThrow({ where: { id: mineId } })).ownerId).toBe(
      rep.id,
    );
    expect(
      (await contactActions.updateContact({ id: mineId, name: "Milik Rep 2", companyIds: [] })).ok,
    ).toBe(true);
    expect((await contactActions.deleteContact({ id: mineId })).ok).toBe(true);
    expect((await testPrisma.contact.findUniqueOrThrow({ where: { id: ownerContact } })).name).toBe(
      "Milik Owner",
    );
  });

  it("sales manager mengubah data anggota timnya, bukan tim lain", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const mgr = await addUserWithRole(orgId, "sales_manager", "Mgr");
    const mate = await addUserWithRole(orgId, "sales_rep", "Mate");
    const stranger = await addUserWithRole(orgId, "sales_rep", "Stranger");
    await testPrisma.team.create({
      data: {
        organizationId: orgId,
        name: "T1",
        members: { create: [mgr, mate].map((u) => ({ organizationId: orgId, userId: u.id })) },
      },
    });
    actAs(mate);
    const mateContact = idOf(await contactActions.createContact({ name: "Kontak Mate" }));
    actAs(stranger);
    const strangerContact = idOf(await contactActions.createContact({ name: "Kontak Stranger" }));
    actAs(mgr);
    expect(
      (
        await contactActions.updateContact({
          id: mateContact,
          name: "Diubah Manager",
          companyIds: [],
        })
      ).ok,
    ).toBe(true);
    expect(
      await contactActions.updateContact({
        id: strangerContact,
        name: "Tidak boleh",
        companyIds: [],
      }),
    ).toEqual({ ok: false, error: "Akses ditolak" });
    expect(owner.id).toBeTruthy();
  });
});

describe("isolasi tenant (IDOR) — contact & company", () => {
  it("tenant lain tidak bisa baca/ubah/hapus, dan daftar tidak bocor", async () => {
    const a = await makeOrg("Org A");
    const contactA = idOf(await contactActions.createContact({ name: "Rahasia A" }));
    const companyA = idOf(await companyActions.createCompany({ name: "PT Rahasia A" }));
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const ctxB = (await getTenantContext())!;

    await expect(contactQ.getContact(ctxB, contactA)).rejects.toMatchObject({ status: 404 });
    await expect(companyQ.getCompany(ctxB, companyA)).rejects.toMatchObject({ status: 404 });
    expect(
      await contactActions.updateContact({ id: contactA, name: "Hijack", companyIds: [] }),
    ).toMatchObject({ ok: false });
    expect(await contactActions.deleteContact({ id: contactA })).toMatchObject({ ok: false });
    expect(await companyActions.updateCompany({ id: companyA, name: "Hijack" })).toMatchObject({
      ok: false,
    });
    expect(await companyActions.deleteCompany({ id: companyA })).toMatchObject({ ok: false });
    expect((await contactQ.listContacts(ctxB, listParams())).total).toBe(0);
    expect(
      (await companyQ.listCompanies(ctxB, parseListParams({}, COMPANY_SORTS, "createdAt"))).total,
    ).toBe(0);
    expect(await contactQ.listCompanyOptions(ctxB)).toEqual([]);

    const row = await testPrisma.contact.findUniqueOrThrow({ where: { id: contactA } });
    expect(row.name).toBe("Rahasia A");
    expect(row.deletedAt).toBeNull();
    expect(a.orgId).toBeTruthy();
  });
});
