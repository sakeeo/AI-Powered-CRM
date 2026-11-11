import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const actions = await import("@/modules/leads/server/actions");
const q = await import("@/modules/leads/server/queries");
const { LEAD_SORTS } = await import("@/modules/leads/constants");

const params = (sp = {}) => parseListParams(sp, LEAD_SORTS, "createdAt");
const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Lead — CRUD, kualifikasi, arsip", () => {
  it("sumber lead bawaan tersedia dan lead dapat dibuat dengan uang tepat (Decimal)", async () => {
    await makeOrg("Org A");
    const sources = await q.listLeadSources(await ctxNow());
    expect(sources.map((s) => s.name)).toContain("Website");
    const web = sources.find((s) => s.name === "Website")!;

    const res = await actions.createLead({
      name: "Andi Prospek",
      email: "Andi@Prospek.com",
      companyName: "CV Prospek",
      needs: "Sistem kasir",
      budget: "15000000.50",
      urgency: "high",
      sourceId: web.id,
    });
    expect(res.ok).toBe(true);
    const lead = await q.getLead(await ctxNow(), idOf(res));
    expect(lead.email).toBe("andi@prospek.com");
    expect(lead.budget).toBe("15000000.50");
    expect(lead.status).toBe("new");
    expect(lead.source?.name).toBe("Website");
  });

  it("validasi: budget >2 desimal, email, nama, sumber tak valid", async () => {
    await makeOrg("Org A");
    expect(await actions.createLead({ name: "Valid", budget: "100.123" })).toMatchObject({
      ok: false,
    });
    expect(await actions.createLead({ name: "Valid", budget: "-5" })).toMatchObject({ ok: false });
    expect(await actions.createLead({ name: "V", email: "x" })).toMatchObject({ ok: false });
    expect(
      await actions.createLead({ name: "Valid", sourceId: "00000000-0000-4000-8000-000000000000" }),
    ).toMatchObject({ ok: false });
    expect(await actions.createLead({ name: "Valid", budget: "1,500,000" })).toMatchObject({
      ok: true,
    });
  });

  it("alur kualifikasi: Unqualified wajib alasan; kembali ke status lain menghapus alasan", async () => {
    await makeOrg("Org A");
    const id = idOf(await actions.createLead({ name: "Lead Q" }));
    expect((await actions.setLeadStatus({ id, status: "contacted" })).ok).toBe(true);
    expect(await actions.setLeadStatus({ id, status: "unqualified" })).toMatchObject({ ok: false });
    expect(
      (await actions.setLeadStatus({ id, status: "unqualified", reason: "Budget tidak cukup" })).ok,
    ).toBe(true);
    let lead = await q.getLead(await ctxNow(), id);
    expect(lead.status).toBe("unqualified");
    expect(lead.unqualifiedReason).toBe("Budget tidak cukup");
    expect((await actions.setLeadStatus({ id, status: "qualified" })).ok).toBe(true);
    lead = await q.getLead(await ctxNow(), id);
    expect(lead.unqualifiedReason).toBeNull();
    expect(await testPrisma.auditLog.count({ where: { action: "lead.status_changed" } })).toBe(3);
  });

  it("arsip menyembunyikan dari daftar default, bisa dipulihkan, dan terarsip tak bisa diubah", async () => {
    await makeOrg("Org A");
    const id = idOf(await actions.createLead({ name: "Lead Arsip" }));
    expect((await actions.archiveLead({ id })).ok).toBe(true);
    expect((await q.listLeads(await ctxNow(), params())).total).toBe(0);
    expect((await q.listLeads(await ctxNow(), params(), { archived: true })).total).toBe(1);
    expect(await actions.updateLead({ id, name: "Ubah" })).toMatchObject({ ok: false });
    expect(await actions.setLeadStatus({ id, status: "qualified" })).toMatchObject({ ok: false });
    expect((await actions.restoreLead({ id })).ok).toBe(true);
    expect((await q.listLeads(await ctxNow(), params())).total).toBe(1);
  });

  it("filter status/sumber/owner/unassigned, pencarian, sort budget", async () => {
    const { owner, orgId } = await makeOrg("Org A");
    const mgr = await addUserWithRole(orgId, "sales_manager", "Mgr");
    const src = (await q.listLeadSources(await ctxNow()))[0];
    await actions.createLead({ name: "Alfa", budget: "100", sourceId: src.id, ownerId: owner.id });
    await actions.createLead({ name: "Beta", budget: "300", ownerId: mgr.id });
    const gamma = idOf(
      await actions.createLead({ name: "Gamma", budget: "200", email: "gamma@x.com" }),
    );
    await actions.setLeadStatus({ id: gamma, status: "qualified" });
    const c = await ctxNow();

    expect(
      (await q.listLeads(c, params(), { status: "qualified" })).rows.map((r) => r.name),
    ).toEqual(["Gamma"]);
    expect((await q.listLeads(c, params(), { sourceId: src.id })).rows.map((r) => r.name)).toEqual([
      "Alfa",
    ]);
    expect((await q.listLeads(c, params(), { owner: mgr.id })).rows.map((r) => r.name)).toEqual([
      "Beta",
    ]);
    expect(
      (await q.listLeads(c, params(), { owner: "unassigned" })).rows.map((r) => r.name),
    ).toEqual(["Gamma"]);
    expect((await q.listLeads(c, params({ q: "GAMMA@x" }))).total).toBe(1);
    expect(
      (await q.listLeads(c, params({ sort: "budget", dir: "desc" }))).rows.map((r) => r.name),
    ).toEqual(["Beta", "Gamma", "Alfa"]);
  });
});

describe("Lead — assignment & izin Sales Rep", () => {
  it("manager menugaskan lead; rep hanya melihat/mengubah leadnya sendiri dan tak bisa melepas lead", async () => {
    const { owner, orgId } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const rep2 = await addUserWithRole(orgId, "sales_rep", "Rep2");
    const unassigned = idOf(await actions.createLead({ name: "Belum Ditugaskan" }));
    const forRep = idOf(await actions.createLead({ name: "Untuk Rep" }));
    expect((await actions.assignLead({ id: forRep, ownerId: rep.id })).ok).toBe(true);
    expect(
      await actions.assignLead({ id: forRep, ownerId: "00000000-0000-4000-8000-000000000000" }),
    ).toMatchObject({ ok: false });

    actAs(rep);
    const c = await ctxNow();
    expect((await q.listLeads(c, params())).rows.map((r) => r.name)).toEqual(["Untuk Rep"]);
    await expect(q.getLead(c, unassigned)).rejects.toMatchObject({ status: 404 });
    expect((await actions.updateLead({ id: forRep, name: "Untuk Rep (diubah)" })).ok).toBe(true);
    expect(await actions.assignLead({ id: forRep, ownerId: rep2.id })).toMatchObject({ ok: false });
    expect(await actions.updateLead({ id: unassigned, name: "Curi" })).toMatchObject({ ok: false });
    expect(await actions.archiveLead({ id: unassigned })).toMatchObject({ ok: false });

    // lead buatan rep otomatis dimiliki rep
    const mine = idOf(await actions.createLead({ name: "Buatan Rep", ownerId: owner.id }));
    expect((await testPrisma.lead.findUniqueOrThrow({ where: { id: mine } })).ownerId).toBe(rep.id);

    // rep lain tak melihat lead rep ini
    actAs(rep2);
    const c2 = await ctxNow();
    expect((await q.listLeads(c2, params())).total).toBe(0);
    await expect(q.getLead(c2, forRep)).rejects.toMatchObject({ status: 404 });
  });

  it("viewer hanya baca", async () => {
    const { orgId } = await makeOrg("Org A");
    const id = idOf(await actions.createLead({ name: "Lead V" }));
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    actAs(viewer);
    expect((await q.listLeads(await ctxNow(), params())).total).toBe(1);
    expect(await actions.createLead({ name: "x y" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect(await actions.setLeadStatus({ id, status: "contacted" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
  });
});

describe("Lead Source (SET-06)", () => {
  it("Owner/Admin mengonfigurasi; manager/rep tidak; sumber sistem terlindungi; tidak dipakai jika nonaktif", async () => {
    const { orgId } = await makeOrg("Org A");
    const mgr = await addUserWithRole(orgId, "sales_manager", "Mgr");
    expect((await actions.createLeadSource({ name: "Iklan Koran" })).ok).toBe(true);
    expect((await actions.createLeadSource({ name: "iklan koran" })).ok).toBe(false); // duplikat (case-insensitive)
    const list = await q.listLeadSources(await ctxNow());
    const koran = list.find((s) => s.name === "Iklan Koran")!;
    const web = list.find((s) => s.name === "Website")!;
    expect((await actions.renameLeadSource({ id: koran.id, name: "Iklan Majalah" })).ok).toBe(true);
    expect((await actions.renameLeadSource({ id: web.id, name: "Situs" })).ok).toBe(false);
    expect((await actions.toggleLeadSource({ id: web.id, isActive: false })).ok).toBe(false);
    expect((await actions.toggleLeadSource({ id: koran.id, isActive: false })).ok).toBe(true);
    expect(await actions.createLead({ name: "Pakai Nonaktif", sourceId: koran.id })).toMatchObject({
      ok: false,
    });

    actAs(mgr);
    expect(await actions.createLeadSource({ name: "Sumber Baru" })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
    expect((await q.listLeadSources(await ctxNow())).length).toBeGreaterThan(0); // boleh melihat
  });
});

describe("Lead — isolasi tenant", () => {
  it("tenant lain tak bisa membaca/mengubah lead dan tak bisa memakai sumber lead org lain", async () => {
    const a = await makeOrg("Org A");
    const idA = idOf(await actions.createLead({ name: "Rahasia A" }));
    const srcA = (await q.listLeadSources(await ctxNow()))[0];
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const cB = await ctxNow();
    await expect(q.getLead(cB, idA)).rejects.toMatchObject({ status: 404 });
    expect((await q.listLeads(cB, params())).total).toBe(0);
    expect(await actions.updateLead({ id: idA, name: "Hijack" })).toMatchObject({ ok: false });
    expect(await actions.setLeadStatus({ id: idA, status: "qualified" })).toMatchObject({
      ok: false,
    });
    expect(await actions.assignLead({ id: idA, ownerId: b.owner.id })).toMatchObject({ ok: false });
    expect(await actions.archiveLead({ id: idA })).toMatchObject({ ok: false });
    expect(await actions.createLead({ name: "Pakai Sumber A", sourceId: srcA.id })).toMatchObject({
      ok: false,
    });
    expect(await actions.renameLeadSource({ id: srcA.id, name: "Hijack" })).toMatchObject({
      ok: false,
    });
    const row = await testPrisma.lead.findUniqueOrThrow({ where: { id: idA } });
    expect(row).toMatchObject({ name: "Rahasia A", status: "new", archivedAt: null });
    expect(a.orgId).toBeTruthy();
  });
});
