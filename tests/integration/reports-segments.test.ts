import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { mails } from "../helpers/mails";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const custQ = await import("@/modules/customers/server/queries");
const custA = await import("@/modules/customers/server/actions");
const segA = await import("@/modules/customers/server/segment-actions");
const { CUSTOMER_SORTS } = await import("@/modules/customers/schemas");
const { getReport } = await import("@/modules/reports/server/reports");
const { reportToCsv } = await import("@/modules/reports/server/export");
const savedA = await import("@/modules/reports/server/saved-actions");
const savedQ = await import("@/modules/reports/server/saved-queries");
const { runDueReportSchedules } = await import("@/lib/report-schedule");
const { GET: exportSaved } = await import("@/app/api/reports/saved/[id]/export/route");
const tagA = await import("@/modules/customization/server/actions");
const companyA = await import("@/modules/companies/server/actions");
const dealA = await import("@/modules/deals/server/actions");
const { NextRequest } = await import("next/server");
const { headersFor } = await import("../helpers/auth");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const p = () => parseListParams({}, CUSTOMER_SORTS, "lastWonAt");

beforeEach(async () => {
  await resetDb();
  mails.length = 0;
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

/** Company dengan deal Won bernilai `value` yang ditutup `daysAgo` hari lalu. */
async function customer(
  name: string,
  value: string,
  daysAgo: number,
  opts: { tagId?: string; owner?: string } = {},
) {
  const company = idOf(await companyA.createCompany({ name, ownerId: opts.owner }));
  const deal = idOf(
    await dealA.createDeal({
      title: `Deal ${name}`,
      companyId: company,
      value,
      ownerId: opts.owner,
    }),
  );
  await dealA.markDealWon({ id: deal });
  await testPrisma.deal.update({
    where: { id: deal },
    data: { closedAt: new Date(Date.now() - daysAgo * 86_400_000) },
  });
  if (opts.tagId)
    await tagA.setEntityTags({ entityType: "company", entityId: company, tagIds: [opts.tagId] });
  return company;
}

describe("Segmen dinamis", () => {
  it("anggota dihitung dari aturan (nilai, recency, tag) dan dapat difilter; berubah otomatis tanpa salinan", async () => {
    await makeOrg("Org A");
    const vip = idOf(await tagA.createTag({ name: "VIP", color: "green" }));
    await customer("Besar Baru", "9000000", 5, { tagId: vip });
    await customer("Besar Lama", "8000000", 200);
    await customer("Kecil Baru", "100000", 2);
    const seg = idOf(
      await segA.createDynamicSegment({
        name: "Pelanggan Besar",
        rules: { party: "all", minTotal: 5_000_000 },
      }),
    );
    const dorm = idOf(
      await segA.createDynamicSegment({ name: "Tidur", rules: { party: "all", inactiveDays: 90 } }),
    );
    const vipSeg = idOf(
      await segA.createDynamicSegment({ name: "Tag VIP", rules: { party: "all", tagIds: [vip] } }),
    );
    const ctx = await ctxNow();
    const names = async (segmentId: string) =>
      (await custQ.listCustomers(ctx, p(), { segmentId })).rows.map((r) => r.name).sort();
    expect(await names(seg)).toEqual(["Besar Baru", "Besar Lama"]);
    expect(await names(dorm)).toEqual(["Besar Lama"]);
    expect(await names(vipSeg)).toEqual(["Besar Baru"]);
    expect(await testPrisma.customerSegmentMember.count()).toBe(0); // tidak ada salinan keanggotaan
    // data berubah → keanggotaan ikut berubah
    await testPrisma.deal.updateMany({
      where: { title: "Deal Kecil Baru" },
      data: { value: "7000000" },
    });
    expect(await names(seg)).toEqual(["Besar Baru", "Besar Lama", "Kecil Baru"]);
    // ubah aturan
    await segA.updateDynamicSegment({
      id: seg,
      name: "Pelanggan Besar",
      rules: { party: "all", minTotal: 8_500_000 },
    });
    expect(await names(seg)).toEqual(["Besar Baru"]);
    const all = await custQ.listCustomers(ctx, p());
    expect(
      all.rows
        .find((r) => r.name === "Besar Baru")!
        .segments.map((s) => s.name)
        .sort(),
    ).toEqual(["Pelanggan Besar", "Tag VIP"]);
    // Customer 360 menampilkan segmen dinamis
    const c360 = await custQ.getCustomer360(
      ctx,
      "company",
      all.rows.find((r) => r.name === "Besar Lama")!.id,
    );
    expect(c360.dynamicSegments.map((s) => s.name)).toEqual(["Tidur"]);
    expect((await custQ.listDynamicSegments(ctx)).map((s) => s.name)).toEqual([
      "Pelanggan Besar",
      "Tag VIP",
      "Tidur",
    ]);
  });

  it("izin: hanya Owner/Admin/Manager; nama unik; tag harus ada; tidak bisa diisi manual; tenant terisolasi", async () => {
    const a = await makeOrg("Org A");
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(a.orgId, "sales_manager", "Mgr");
    const rules = { party: "all" as const, minTotal: 1 };
    actAs(rep);
    expect(await segA.createDynamicSegment({ name: "Segmen Rep", rules })).toMatchObject({
      ok: false,
    });
    actAs(mgr);
    const id = idOf(await segA.createDynamicSegment({ name: "Segmen Mgr", rules }));
    expect(await segA.createDynamicSegment({ name: "segmen mgr", rules })).toMatchObject({
      ok: false,
    });
    expect(
      await segA.createDynamicSegment({
        name: "Tag Salah",
        rules: { party: "all", tagIds: ["11111111-1111-4111-8111-111111111111"] },
      }),
    ).toMatchObject({ ok: false });
    expect(
      await segA.createDynamicSegment({ name: "Kosong", rules: { party: "all" } }),
    ).toMatchObject({ ok: false });
    actAs(a.owner);
    const c = await customer("Pelanggan", "100", 1);
    expect(await custA.assignSegment({ type: "company", id: c, name: "Segmen Mgr" })).toMatchObject(
      { ok: false },
    );
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await segA.deleteDynamicSegment({ id })).toMatchObject({ ok: false });
    expect(await segA.updateDynamicSegment({ id, name: "Bajak", rules })).toMatchObject({
      ok: false,
    });
    expect(await custQ.listDynamicSegments(await ctxNow())).toHaveLength(0);
    actAs(rep);
    expect(await segA.deleteDynamicSegment({ id })).toMatchObject({ ok: false });
  });

  it("laporan Segmen Pelanggan: angka cocok, mendukung export, segmen statis & dinamis", async () => {
    await makeOrg("Org A");
    await customer("Alfa", "3000000", 10);
    await customer("Beta", "1000000", 400);
    await customer("Gama", "500000", 5);
    const ctx = await ctxNow();
    const alfa = (await custQ.listCustomers(ctx, p())).rows.find((r) => r.name === "Alfa")!;
    await custA.assignSegment({ type: "company", id: alfa.id, name: "Kunci" });
    await segA.createDynamicSegment({
      name: "Aktif 30 hari",
      rules: { party: "all", wonWithinDays: 30 },
    });
    const rep = await getReport(ctx, "segment");
    const rows = Object.fromEntries(rep.sections[0].rows.map((r) => [r[0], r]));
    expect(rows["Kunci"][1]).toBe("Statis");
    expect(rows["Kunci"][2]).toBe(1);
    expect(rows["Aktif 30 hari"][1]).toBe("Dinamis");
    expect(rows["Aktif 30 hari"][2]).toBe(2); // Alfa + Gama
    expect(rows["Aktif 30 hari"][3]).toContain("3.500.000");
    expect(rows["Tanpa segmen"][2]).toBe(1); // Beta
    expect(reportToCsv(rep)).toContain("Aktif 30 hari");
  });
});

describe("Report builder & laporan tersimpan", () => {
  const def = (over: Record<string, unknown> = {}) => ({
    entity: "lead" as const,
    metric: "count" as const,
    filters: [],
    period: { field: "createdAt", preset: "all" as const },
    groupBy: null,
    limit: 10,
    ...over,
  });

  it("menjalankan dengan izin pembaca; definisi di luar whitelist ditolak; rep hanya melihat miliknya", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    await testPrisma.lead.createMany({
      data: [
        { organizationId: o.orgId, name: "L1", ownerId: rep.id },
        { organizationId: o.orgId, name: "L2", ownerId: rep.id },
        { organizationId: o.orgId, name: "L3" },
      ],
    });
    actAs(o.owner);
    expect(await savedA.runCustomReport({ definition: def() })).toMatchObject({
      ok: true,
      data: { rows: [[3]] },
    });
    actAs(rep);
    expect(await savedA.runCustomReport({ definition: def() })).toMatchObject({
      ok: true,
      data: { rows: [[2]] },
    });
    expect(
      await savedA.runCustomReport({
        definition: def({ filters: [{ field: "organizationId", value: "x" }] }),
      }),
    ).toMatchObject({ ok: false });
    const viewer = await addUserWithRole(o.orgId, "viewer", "Vi");
    actAs(viewer);
    expect(await savedA.runCustomReport({ definition: def() })).toMatchObject({ ok: true });
  });

  it("simpan/daftar/ubah/hapus: milik sendiri vs dibagikan; hanya pemilik/admin mengubah; lintas tenant terisolasi", async () => {
    const o = await makeOrg("Org A");
    const rep1 = await addUserWithRole(o.orgId, "sales_rep", "Rep1");
    const rep2 = await addUserWithRole(o.orgId, "sales_rep", "Rep2");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    actAs(mgr);
    const shared = idOf(
      await savedA.saveCustomReport({
        name: "Laporan Bersama",
        definition: def(),
        visibility: "organization",
      }),
    );
    actAs(rep1);
    const mine = idOf(
      await savedA.saveCustomReport({
        name: "Laporan Rep1",
        definition: def({ metric: "list" }),
        visibility: "personal",
      }),
    );
    expect(
      await savedA.saveCustomReport({
        name: "Coba Bagikan",
        definition: def(),
        visibility: "organization",
      }),
    ).toMatchObject({ ok: false });
    const list = async (u: Parameters<typeof actAs>[0]) => {
      actAs(u);
      return (await savedQ.listSavedReports(await ctxNow())).map((r) => r.name).sort();
    };
    expect(await list(rep1)).toEqual(["Laporan Bersama", "Laporan Rep1"]);
    expect(await list(rep2)).toEqual(["Laporan Bersama"]);
    actAs(rep2);
    expect(await savedA.deleteCustomReport({ id: mine })).toMatchObject({ ok: false });
    expect(await savedA.deleteCustomReport({ id: shared })).toMatchObject({ ok: false });
    expect(
      await savedA.saveCustomReport({
        id: shared,
        name: "Bajak",
        definition: def(),
        visibility: "organization",
      }),
    ).toMatchObject({ ok: false });
    await expect(savedQ.getSavedReport(await ctxNow(), mine)).rejects.toThrow();
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await savedQ.listSavedReports(await ctxNow())).toHaveLength(0);
    expect(await savedA.deleteCustomReport({ id: shared })).toMatchObject({ ok: false });
    actAs(o.owner);
    expect(await savedA.deleteCustomReport({ id: mine })).toMatchObject({ ok: true });
  });

  it("export laporan tersimpan: butuh izin export; dihitung dengan izin pengunduh; anti formula-injection", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "=CMD()", ownerId: o.owner.id },
    });
    actAs(o.owner);
    const id = idOf(
      await savedA.saveCustomReport({
        name: "Daftar Lead",
        definition: def({ metric: "list" }),
        visibility: "organization",
      }),
    );
    const call = async (u: { cookie: string }, format = "csv") => {
      actAs(u);
      const { current } = await import("../helpers/current-user");
      current.cookie = u.cookie;
      const res = await exportSaved(
        new NextRequest(`http://localhost/api/reports/saved/${id}/export?format=${format}`, {
          headers: headersFor(u),
        }),
        { params: Promise.resolve({ id }) } as never,
      );
      return { status: res.status, text: await res.text() };
    };
    const ok = await call(o.owner);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("'=CMD()");
    expect((await call(rep)).status).toBe(403);
    expect(await testPrisma.auditLog.count({ where: { action: "report.exported" } })).toBe(1);
  });
});

describe("Laporan terjadwal", () => {
  const def = {
    entity: "lead" as const,
    metric: "count" as const,
    filters: [] as { field: string; value: string }[],
    period: { field: "createdAt", preset: "all" as const },
    groupBy: null,
    limit: 10,
  };

  it("jadwal: penerima harus anggota aktif; butuh izin export; hanya pemilik; nextRunAt dihitung", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const stranger = await makeOrg("Org B");
    actAs(o.owner);
    const id = idOf(
      await savedA.saveCustomReport({ name: "Mingguan", definition: def, visibility: "personal" }),
    );
    const base = { id, frequency: "weekly" as const, weekday: 1, hour: 8, recipientIds: [mgr.id] };
    actAs(o.owner);
    expect(await savedA.scheduleCustomReport({ ...base, recipientIds: [] })).toMatchObject({
      ok: false,
    });
    expect(
      await savedA.scheduleCustomReport({ ...base, recipientIds: [stranger.owner.id] }),
    ).toMatchObject({ ok: false });
    expect(await savedA.scheduleCustomReport({ ...base, weekday: undefined })).toMatchObject({
      ok: false,
    });
    const res = await savedA.scheduleCustomReport(base);
    expect(res).toMatchObject({ ok: true });
    expect(
      (await testPrisma.savedReport.findUniqueOrThrow({ where: { id } })).nextRunAt!.getTime(),
    ).toBeGreaterThan(Date.now());
    actAs(rep);
    expect(await savedA.scheduleCustomReport({ ...base })).toMatchObject({ ok: false });
    actAs(o.owner);
    expect(
      await savedA.scheduleCustomReport({ id, frequency: "none", hour: 8, recipientIds: [] }),
    ).toMatchObject({ ok: true });
    expect(
      (await testPrisma.savedReport.findUniqueOrThrow({ where: { id } })).nextRunAt,
    ).toBeNull();
    // rep (tanpa izin export) tidak dapat menjadwalkan laporannya sendiri
    actAs(rep);
    const own = idOf(
      await savedA.saveCustomReport({ name: "Rep", definition: def, visibility: "personal" }),
    );
    expect(
      await savedA.scheduleCustomReport({
        id: own,
        frequency: "daily",
        hour: 8,
        recipientIds: [rep.id],
      }),
    ).toMatchObject({ ok: false });
  });

  it("terkirim sekali per jatuh tempo (paralel aman); tiap penerima menerima data sesuai IZINNYA sendiri", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Vi");
    await testPrisma.lead.createMany({
      data: [
        { organizationId: o.orgId, name: "A", ownerId: rep.id },
        { organizationId: o.orgId, name: "B" },
        { organizationId: o.orgId, name: "C" },
      ],
    });
    actAs(o.owner);
    const id = idOf(
      await savedA.saveCustomReport({
        name: "Harian Lead",
        definition: def,
        visibility: "organization",
      }),
    );
    await savedA.scheduleCustomReport({
      id,
      frequency: "daily",
      hour: 8,
      recipientIds: [mgr.id, rep.id, viewer.id],
    });
    await testPrisma.savedReport.update({
      where: { id },
      data: { nextRunAt: new Date(Date.now() - 60_000) },
    });
    const results = await Promise.all([
      runDueReportSchedules(),
      runDueReportSchedules(),
      runDueReportSchedules(),
    ]);
    expect(results.reduce((n, r) => n + r.emails, 0)).toBe(3);
    expect(mails).toHaveLength(3);
    const by = Object.fromEntries(mails.map((m) => [m.to, m]));
    const count = (email: string) => by[email].text.match(/Ada (\d+) lead/)?.[1];
    expect(count(mgr.email)).toBe("3");
    expect(count(viewer.email)).toBe("3");
    expect(count(rep.email)).toBe("1"); // izin rep: hanya miliknya
    expect(by[mgr.email].subject).toContain("Harian Lead");
    const row = await testPrisma.savedReport.findUniqueOrThrow({ where: { id } });
    expect(row.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(row.lastStatus).toBe("Terkirim 3, dilewati 0");
    // belum jatuh tempo → tidak kirim lagi
    mails.length = 0;
    expect(await runDueReportSchedules()).toEqual({ reports: 0, emails: 0 });
    expect(mails).toHaveLength(0);
  });

  it("penerima yang dinonaktifkan dilewati; jadwal tenant lain tidak bocor; definisi rusak ditandai", async () => {
    const o = await makeOrg("Org A");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    actAs(o.owner);
    const id = idOf(
      await savedA.saveCustomReport({ name: "Laporan", definition: def, visibility: "personal" }),
    );
    await savedA.scheduleCustomReport({ id, frequency: "daily", hour: 8, recipientIds: [mgr.id] });
    await testPrisma.member.updateMany({ where: { userId: mgr.id }, data: { active: false } });
    await testPrisma.savedReport.update({
      where: { id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    expect(await runDueReportSchedules()).toEqual({ reports: 1, emails: 0 });
    expect(mails).toHaveLength(0);
    expect((await testPrisma.savedReport.findUniqueOrThrow({ where: { id } })).lastStatus).toBe(
      "Terkirim 0, dilewati 1",
    );
    await testPrisma.savedReport.update({
      where: { id },
      data: { definition: { entity: "users" }, nextRunAt: new Date(Date.now() - 1000) },
    });
    await runDueReportSchedules();
    expect((await testPrisma.savedReport.findUniqueOrThrow({ where: { id } })).lastStatus).toBe(
      "Definisi tidak valid",
    );
  });
});
