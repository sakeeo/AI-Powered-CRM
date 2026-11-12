import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { scanOrgInsights, scanAllInsights } = await import("@/lib/insight-scan");
const ins = await import("@/modules/intelligence/server/insights");
const insA = await import("@/modules/intelligence/server/insight-actions");

const ctxNow = async () => (await getTenantContext())!;
const NOW = new Date("2026-11-12T06:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

/** 5 customer; hanya "PT Besar" VIP (total terbesar) dengan banyak aktivitas lama & nol aktivitas baru. */
async function seedVipDrop(orgId: string, ownerId?: string) {
  const pipeline = await testPrisma.pipeline.create({
    data: { organizationId: orgId, name: "P", isDefault: true },
  });
  const stage = await testPrisma.pipelineStage.create({
    data: { organizationId: orgId, pipelineId: pipeline.id, name: "S", position: 1 },
  });
  const names = ["PT Besar", "CV A", "CV B", "CV C", "CV D"];
  const ids: string[] = [];
  for (const [i, name] of names.entries()) {
    const c = await testPrisma.company.create({
      data: { organizationId: orgId, name, ownerId: i === 0 ? ownerId : undefined },
    });
    ids.push(c.id);
    await testPrisma.deal.create({
      data: {
        organizationId: orgId,
        title: `Won ${name}`,
        pipelineId: pipeline.id,
        stageId: stage.id,
        status: "won",
        value: i === 0 ? 1_000_000_000 : 1_000_000,
        companyId: c.id,
        closedAt: ago(200),
      },
    });
  }
  for (let i = 0; i < 8; i++)
    await testPrisma.activity.create({
      data: {
        organizationId: orgId,
        type: "call",
        subject: `Call ${i}`,
        status: "done",
        companyId: ids[0],
        createdAt: ago(40 + i * 8),
        completedAt: ago(40 + i * 8),
      },
    });
  return ids;
}

describe("Insight & anomaly detection (plan 3.4)", () => {
  it("mendeteksi penurunan aktivitas VIP, membuat alert + notifikasi in-app; idempoten per pekan", async () => {
    const o = await makeOrg("Org A");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const ids = await seedVipDrop(o.orgId, rep.id);

    const r1 = await scanOrgInsights(o.orgId, NOW);
    expect(r1).toMatchObject({ detected: 1, created: 1 });
    const alert = await testPrisma.insightAlert.findFirstOrThrow();
    expect(alert).toMatchObject({
      kind: "vip_activity_drop",
      severity: "high",
      subjectId: ids[0],
      ownerId: rep.id,
    });
    // penerima: owner org + manager + pemilik (rep)
    const notes = await testPrisma.notification.findMany({ where: { type: "insight_anomaly" } });
    const users = notes.map((n) => n.userId).sort();
    expect(users).toEqual([o.owner.id, mgr.id, rep.id].sort());
    expect(notes[0]!.link).toBe(`/customers/company/${ids[0]}`);

    // pemindaian ulang (atau worker ganda) → tidak ganda
    expect(await scanOrgInsights(o.orgId, NOW)).toMatchObject({ created: 0, notified: 0 });
    expect(await testPrisma.insightAlert.count()).toBe(1);
    expect(await testPrisma.notification.count({ where: { type: "insight_anomaly" } })).toBe(3);
    // pekan berikutnya, masih anomali → alert baru
    const next = new Date(NOW.getTime() + 8 * 86_400_000);
    expect(await scanOrgInsights(o.orgId, next)).toMatchObject({ created: 1 });
  });

  it("tanpa aksi otonom: hanya insight_alerts & notifications yang berubah (Red Zone)", async () => {
    const o = await makeOrg("Org A");
    await seedVipDrop(o.orgId);
    const before = await snapshotDb(["insight_alerts", "notifications"]);
    await scanAllInsights(NOW);
    expect(await testPrisma.insightAlert.count()).toBe(1);
    expect(await snapshotDb(["insight_alerts", "notifications"])).toEqual(before);
    expect(await testPrisma.activity.count({ where: { type: "task" } })).toBe(0);
  });

  it("customer VIP yang aktivitasnya wajar tidak ditandai", async () => {
    const o = await makeOrg("Org A");
    const ids = await seedVipDrop(o.orgId);
    for (let i = 0; i < 4; i++)
      await testPrisma.activity.create({
        data: {
          organizationId: o.orgId,
          type: "call",
          subject: `Baru ${i}`,
          status: "done",
          companyId: ids[0],
          createdAt: ago(2 + i),
          completedAt: ago(2 + i),
        },
      });
    expect((await scanOrgInsights(o.orgId, NOW)).detected).toBe(0);
  });

  it("insight tingkat organisasi: win rate & aliran lead turun", async () => {
    const o = await makeOrg("Org A");
    const pipeline = await testPrisma.pipeline.create({
      data: { organizationId: o.orgId, name: "P", isDefault: true },
    });
    const stage = await testPrisma.pipelineStage.create({
      data: { organizationId: o.orgId, pipelineId: pipeline.id, name: "S", position: 1 },
    });
    const mk = (status: string, days: number, i: number) =>
      testPrisma.deal.create({
        data: {
          organizationId: o.orgId,
          title: `D${status}${days}${i}`,
          pipelineId: pipeline.id,
          stageId: stage.id,
          status,
          closedAt: ago(days),
        },
      });
    for (let i = 0; i < 6; i++) await mk("won", 60 + i, i); // sebelumnya 6 won / 4 lost
    for (let i = 0; i < 4; i++) await mk("lost", 60 + i, i);
    await mk("won", 5, 0); // 30 hari terakhir: 1 won / 5 lost
    for (let i = 0; i < 5; i++) await mk("lost", 5, i);
    for (let i = 0; i < 40; i++)
      await testPrisma.lead.create({
        data: { organizationId: o.orgId, name: `L${i}`, createdAt: ago(20 + (i % 40)) },
      });
    await scanOrgInsights(o.orgId, NOW);
    const kinds = (await testPrisma.insightAlert.findMany()).map((a) => a.kind).sort();
    expect(kinds).toEqual(["lead_inflow_drop", "win_rate_drop"]);
    const win = await testPrisma.insightAlert.findFirstOrThrow({
      where: { kind: "win_rate_drop" },
    });
    expect(win.subjectId).toBeNull();
  });

  it("visibilitas & izin: rep hanya melihat/menutup alert miliknya; viewer tak boleh memindai; lintas tenant terisolasi", async () => {
    const o = await makeOrg("Org A");
    const repA = await addUserWithRole(o.orgId, "sales_rep", "Rep A");
    const repB = await addUserWithRole(o.orgId, "sales_rep", "Rep B");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Viewer");
    await seedVipDrop(o.orgId, repA.id);
    await scanOrgInsights(o.orgId, NOW);
    const alert = await testPrisma.insightAlert.findFirstOrThrow();

    actAs(repB);
    expect(await ins.listInsightAlerts(await ctxNow())).toHaveLength(0);
    expect(await insA.dismissInsightAlert({ id: alert.id })).toMatchObject({ ok: false });
    actAs(viewer);
    expect(await insA.scanInsightsNow({})).toMatchObject({ ok: false });
    actAs(repA);
    expect(await ins.listInsightAlerts(await ctxNow())).toHaveLength(1);
    expect(await insA.dismissInsightAlert({ id: alert.id })).toMatchObject({ ok: true });
    expect(await ins.listInsightAlerts(await ctxNow())).toHaveLength(0);

    await makeOrg("Org B");
    expect(await ins.listInsightAlerts(await ctxNow())).toHaveLength(0);
    expect(await insA.dismissInsightAlert({ id: alert.id })).toMatchObject({ ok: false });
  });
});
