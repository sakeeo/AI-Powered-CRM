import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { closeQueues, getQueue, QUEUES } = await import("@/lib/queue");
const { runAutomations, scanAutomationTriggers, emitAutomationEvent } =
  await import("@/lib/automation");
const actions = await import("@/modules/automation/server/actions");
const q = await import("@/modules/automation/server/queries");
const { getTenantContext } = await import("@/lib/context");
const leadActions = await import("@/modules/leads/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");
const { forTenant } = await import("@/lib/tenant");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const queue = () => getQueue(QUEUES.automation);

beforeEach(async () => {
  await resetDb();
  await queue().obliterate({ force: true });
});
afterAll(async () => {
  await queue().obliterate({ force: true });
  await closeQueues();
  await redis.quit();
  await testPrisma.$disconnect();
});

const notif = (to = "owner" as const) => ({
  type: "send_notification" as const,
  title: "Lead baru: {{name}}",
  to,
});

describe("Rule CRUD & izin", () => {
  it("membuat, menonaktifkan, mengubah, menghapus; aksi harus sesuai trigger; penerima anggota aktif", async () => {
    const o = await makeOrg("Org A");
    const base = { name: "Rule A", maxPerHour: 50, isActive: true };
    expect(
      await actions.createRule({ ...base, trigger: "lead_created", actions: [] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createRule({
        ...base,
        trigger: "task_due",
        actions: [{ type: "assign_owner", userIds: [o.owner.id], onlyIfUnassigned: true }],
      }),
    ).toMatchObject({ ok: false });
    const stranger = await makeOrg("Org B");
    actAs(o.owner);
    expect(
      await actions.createRule({
        ...base,
        trigger: "lead_created",
        actions: [{ type: "assign_owner", userIds: [stranger.owner.id], onlyIfUnassigned: true }],
      }),
    ).toMatchObject({ ok: false });
    actAs(o.owner);
    const id = idOf(
      await actions.createRule({ ...base, trigger: "lead_created", actions: [notif()] }),
    );
    expect(await actions.toggleRule({ id, isActive: false })).toMatchObject({ ok: true });
    expect((await q.listRules(await ctxNow()))[0].isActive).toBe(false);
    expect(
      await actions.updateRule({
        ...base,
        id,
        name: "Rule A2",
        trigger: "deal_won",
        actions: [notif()],
      }),
    ).toMatchObject({ ok: true });
    expect((await q.listRules(await ctxNow()))[0]).toMatchObject({
      name: "Rule A2",
      trigger: "deal_won",
    });
    expect(await actions.deleteRule({ id })).toMatchObject({ ok: true });
  });

  it("hanya Owner/Admin mengelola; manager hanya melihat; rep & viewer ditolak; lintas tenant ditolak", async () => {
    const o = await makeOrg("Org A");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const input = {
      name: "Rule A",
      maxPerHour: 5,
      isActive: true,
      trigger: "lead_created" as const,
      actions: [notif()],
    };
    actAs(o.owner);
    const id = idOf(await actions.createRule(input));
    actAs(mgr);
    expect(await actions.createRule(input)).toMatchObject({ ok: false });
    expect(await actions.toggleRule({ id, isActive: false })).toMatchObject({ ok: false });
    expect(await q.listRules(await ctxNow())).toHaveLength(1);
    actAs(rep);
    expect(await actions.deleteRule({ id })).toMatchObject({ ok: false });
    await expect(q.listRules(await ctxNow())).rejects.toThrow();
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await q.listRules(await ctxNow())).toHaveLength(0);
    expect(await actions.deleteRule({ id })).toMatchObject({ ok: false });
    expect(await testPrisma.automationRule.count()).toBe(1);
  });
});

describe("Eksekusi", () => {
  it("lead dibuat → assign (round-robin), task, notifikasi; hasil tercatat di log", async () => {
    const o = await makeOrg("Org A");
    const r1 = await addUserWithRole(o.orgId, "sales_rep", "Rep1");
    const r2 = await addUserWithRole(o.orgId, "sales_rep", "Rep2");
    actAs(o.owner);
    await actions.createRule({
      name: "Distribusi lead",
      trigger: "lead_created",
      maxPerHour: 100,
      isActive: true,
      actions: [
        { type: "assign_owner", userIds: [r1.id, r2.id], onlyIfUnassigned: true },
        { type: "create_task", subject: "Hubungi {{name}}", dueInDays: 2, assignTo: "owner" },
        { type: "send_notification", title: "Lead baru {{name}}", to: "owner" },
      ],
    });
    const owners: string[] = [];
    for (const n of ["Lead Satu", "Lead Dua", "Lead Tiga"]) {
      actAs(o.owner);
      const id = idOf(await leadActions.createLead({ name: n }));
      await runAutomations({
        organizationId: o.orgId,
        trigger: "lead_created",
        entityId: id,
        eventKey: `lead_created:${id}`,
      });
      owners.push((await testPrisma.lead.findUnique({ where: { id } }))!.ownerId!);
    }
    // owner pembuat lead (Owner) belum menjadi owner → assign round-robin r1, r2, r1
    expect(owners).toEqual([r1.id, r2.id, r1.id].map((x) => x));
    expect(await testPrisma.activity.count({ where: { type: "task" } })).toBe(3);
    expect(await testPrisma.notification.count({ where: { type: "automation" } })).toBe(3);
    const runs = await q.listRuns(await ctxNow());
    expect(runs).toHaveLength(3);
    expect(runs.every((r) => r.status === "success" && r.results.length === 3)).toBe(true);
  });

  it("eksekusi ganda dicegah: event yang sama berulang/paralel hanya dijalankan sekali", async () => {
    const o = await makeOrg("Org A");
    await actions.createRule({
      name: "Notif",
      trigger: "lead_created",
      maxPerHour: 100,
      isActive: true,
      actions: [
        { type: "create_task", subject: "Follow up {{name}}", dueInDays: 1, assignTo: o.owner.id },
        notif(o.owner.id as never),
      ],
    });
    const id = idOf(await leadActions.createLead({ name: "Lead Ganda" }));
    const event = {
      organizationId: o.orgId,
      trigger: "lead_created" as const,
      entityId: id,
      eventKey: `lead_created:${id}`,
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => runAutomations(event)));
    expect(results.reduce((n, r) => n + r.executed, 0)).toBe(1);
    expect(results.reduce((n, r) => n + r.skipped, 0)).toBe(4);
    await runAutomations(event);
    expect(await testPrisma.activity.count({ where: { type: "task" } })).toBe(1);
    expect(await testPrisma.notification.count({ where: { type: "automation" } })).toBe(1);
    expect(await testPrisma.automationRun.count()).toBe(1);
  });

  it("rule nonaktif tidak berjalan; tidak ada rule → tidak mengantre job", async () => {
    const o = await makeOrg("Org A");
    const id = idOf(
      await actions.createRule({
        name: "Mati",
        trigger: "lead_created",
        maxPerHour: 10,
        isActive: false,
        actions: [notif(o.owner.id as never)],
      }),
    );
    const lead = idOf(await leadActions.createLead({ name: "Lead X" }));
    expect((await queue().getJobCounts()).waiting).toBe(0);
    const ev = {
      organizationId: o.orgId,
      trigger: "lead_created" as const,
      entityId: lead,
      eventKey: "k1",
    };
    expect(await runAutomations(ev)).toMatchObject({ executed: 0 });
    await actions.toggleRule({ id, isActive: true });
    const lead2 = idOf(await leadActions.createLead({ name: "Lead Y" }));
    expect((await queue().getJobCounts()).waiting).toBe(1);
    const jobs = await queue().getJobs(["waiting"]);
    expect(jobs[0].data).toMatchObject({ trigger: "lead_created", entityId: lead2 });
    // event yang sama diantre dua kali → job tetap satu (jobId deterministik)
    await emitAutomationEvent(
      forTenant((await import("@/lib/prisma")).prisma, o.orgId),
      jobs[0].data,
    );
    expect((await queue().getJobCounts()).waiting).toBe(1);
  });

  it("batas laju per jam: kelebihan dicatat rate_limited tanpa menjalankan aksi", async () => {
    const o = await makeOrg("Org A");
    await actions.createRule({
      name: "Dibatasi",
      trigger: "lead_created",
      maxPerHour: 2,
      isActive: true,
      actions: [notif(o.owner.id as never)],
    });
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const id = idOf(await leadActions.createLead({ name: `Lead ${i} Rate` }));
      await runAutomations(
        { organizationId: o.orgId, trigger: "lead_created", entityId: id, eventKey: `e${i}` },
        now,
      );
    }
    const by = async (s: string) => testPrisma.automationRun.count({ where: { status: s } });
    expect(await by("success")).toBe(2);
    expect(await by("rate_limited")).toBe(2);
    expect(await testPrisma.notification.count({ where: { type: "automation" } })).toBe(2);
    // jam berikutnya: jalan lagi
    const id = idOf(await leadActions.createLead({ name: "Lead Berikut" }));
    await runAutomations(
      { organizationId: o.orgId, trigger: "lead_created", entityId: id, eventKey: "late" },
      new Date(now.getTime() + 2 * 3_600_000),
    );
    expect(await by("success")).toBe(3);
  });

  it("deal Won → task & notifikasi; dibuka ulang lalu Won lagi memicu kejadian baru", async () => {
    const o = await makeOrg("Org A");
    await actions.createRule({
      name: "Won",
      trigger: "deal_won",
      maxPerHour: 100,
      isActive: true,
      actions: [
        { type: "create_task", subject: "Onboarding {{name}}", dueInDays: 3, assignTo: "owner" },
      ],
    });
    const c = idOf(await contactActions.createContact({ name: "Pelanggan Won" }));
    const d = idOf(
      await dealActions.createDeal({ title: "Deal Besar", contactId: c, value: "1000" }),
    );
    await dealActions.markDealWon({ id: d });
    let jobs = await queue().getJobs(["waiting"]);
    expect(jobs).toHaveLength(1);
    await runAutomations(jobs[0].data);
    await runAutomations(jobs[0].data);
    expect(await testPrisma.activity.count({ where: { subject: "Onboarding Deal Besar" } })).toBe(
      1,
    );
    await dealActions.reopenDeal({ id: d });
    await new Promise((r) => setTimeout(r, 5));
    await dealActions.markDealWon({ id: d });
    jobs = await queue().getJobs(["waiting"]);
    expect(jobs).toHaveLength(2);
  });

  it("task_due & quotation_expiring dipindai idempoten; pemindaian ulang tidak menggandakan", async () => {
    const o = await makeOrg("Org A");
    await actions.createRule({
      name: "Task due",
      trigger: "task_due",
      maxPerHour: 100,
      isActive: true,
      actions: [{ type: "send_notification", title: "Task jatuh tempo: {{name}}", to: "owner" }],
    });
    const lead = idOf(await leadActions.createLead({ name: "Lead Task" }));
    const now = new Date();
    await testPrisma.activity.createMany({
      data: [
        {
          organizationId: o.orgId,
          type: "task",
          subject: "Sudah lewat",
          status: "open",
          dueAt: new Date(now.getTime() - 3600_000),
          ownerId: o.owner.id,
          leadId: lead,
        },
        {
          organizationId: o.orgId,
          type: "task",
          subject: "Masa depan",
          status: "open",
          dueAt: new Date(now.getTime() + 86_400_000),
          ownerId: o.owner.id,
          leadId: lead,
        },
        {
          organizationId: o.orgId,
          type: "task",
          subject: "Selesai",
          status: "done",
          dueAt: new Date(now.getTime() - 3600_000),
          ownerId: o.owner.id,
          leadId: lead,
        },
      ],
    });
    await scanAutomationTriggers(now);
    await scanAutomationTriggers(now);
    const n = await testPrisma.notification.findMany({ where: { type: "automation" } });
    expect(n.map((x) => x.title)).toEqual(["Task jatuh tempo: Sudah lewat"]);
    expect(await testPrisma.automationRun.count()).toBe(1);
  });

  it("aksi gagal (penerima bukan anggota aktif) dicatat failed dan menghentikan aksi berikutnya", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    actAs(o.owner);
    await actions.createRule({
      name: "Rapuh",
      trigger: "lead_created",
      maxPerHour: 100,
      isActive: true,
      actions: [
        notif(rep.id as never),
        { type: "create_task", subject: "Tugas {{name}}", dueInDays: 1, assignTo: "owner" },
      ],
    });
    const lead = idOf(await leadActions.createLead({ name: "Lead Rapuh" }));
    await testPrisma.member.updateMany({ where: { userId: rep.id }, data: { active: false } });
    const res = await runAutomations({
      organizationId: o.orgId,
      trigger: "lead_created",
      entityId: lead,
      eventKey: "x",
    });
    expect(res.failed).toBe(1);
    const run = (await q.listRuns(await ctxNow()))[0];
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/anggota aktif/);
    expect(await testPrisma.activity.count({ where: { type: "task" } })).toBe(0);
  });

  it("isolasi tenant: event org A tidak menjalankan rule org B", async () => {
    const a = await makeOrg("Org A");
    const b = await makeOrg("Org B");
    actAs(b.owner);
    await actions.createRule({
      name: "Rule B",
      trigger: "lead_created",
      maxPerHour: 100,
      isActive: true,
      actions: [notif(b.owner.id as never)],
    });
    actAs(a.owner);
    const lead = idOf(await leadActions.createLead({ name: "Lead A" }));
    const res = await runAutomations({
      organizationId: a.orgId,
      trigger: "lead_created",
      entityId: lead,
      eventKey: "k",
    });
    expect(res).toMatchObject({ executed: 0, skipped: 0, failed: 0 });
    // entity org A diberikan sebagai event org B → data tidak ditemukan (tidak bocor)
    const leak = await runAutomations({
      organizationId: b.orgId,
      trigger: "lead_created",
      entityId: lead,
      eventKey: "k2",
    });
    expect(leak.failed).toBe(1);
    expect(await testPrisma.notification.count()).toBe(0);
  });
});
