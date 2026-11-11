import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const actions = await import("@/modules/activities/server/actions");
const q = await import("@/modules/activities/server/queries");
const leadActions = await import("@/modules/leads/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const dealQ = await import("@/modules/deals/server/queries");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

async function lead(name = "Lead Aktivitas") {
  return idOf(await leadActions.createLead({ name }));
}

describe("Activity — CRUD, relasi, izin", () => {
  it("task dan log (call/note) tertaut ke lead; log tanpa jadwal langsung selesai", async () => {
    await makeOrg("Org A");
    const leadId = await lead();
    const task = await actions.createActivity({
      type: "task",
      subject: "Telepon besok",
      dueLocal: "2099-01-01",
      leadId,
    });
    const note = await actions.createActivity({
      type: "note",
      subject: "Hasil diskusi",
      body: "<p>OK <script>x</script></p>",
      leadId,
    });
    const meeting = await actions.createActivity({
      type: "meeting",
      subject: "Demo",
      dueLocal: "2099-02-01T10:00",
      leadId,
    });
    expect(task.ok && note.ok && meeting.ok).toBe(true);
    const rows = await testPrisma.activity.findMany({ where: { leadId } });
    const by = Object.fromEntries(rows.map((r) => [r.type, r]));
    expect(by.task.status).toBe("open");
    expect(by.note).toMatchObject({ status: "done" });
    expect(by.note.completedAt).not.toBeNull();
    expect(by.note.body).not.toContain("script");
    expect(by.meeting.status).toBe("open");
  });

  it("tautan ke record yang tidak ada / milik tenant lain ditolak", async () => {
    const a = await makeOrg("Org A");
    const leadA = await lead("Lead A");
    await makeOrg("Org B");
    expect(
      await actions.createActivity({ type: "note", subject: "Intip", leadId: leadA }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.createActivity({
        type: "note",
        subject: "Hantu",
        dealId: "00000000-0000-4000-8000-000000000000",
      }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.activity.count()).toBe(0);
    void a;
  });

  it("timeline satu record: hanya aktivitas record itu, terbaru di atas", async () => {
    await makeOrg("Org A");
    const l1 = await lead("L1");
    const l2 = await lead("L2");
    for (const s of ["Pertama", "Kedua", "Ketiga"]) {
      await actions.createActivity({ type: "note", subject: s, leadId: l1 });
      await new Promise((r) => setTimeout(r, 5));
    }
    await actions.createActivity({ type: "note", subject: "Milik L2", leadId: l2 });
    const t = await q.listTimeline(await ctxNow(), { leadId: l1 });
    expect(t.map((a) => a.subject)).toEqual(["Ketiga", "Kedua", "Pertama"]);
  });

  it("Sales Rep: hanya aktivitas miliknya, tidak bisa mengubah milik orang lain; Viewer read-only", async () => {
    const { orgId, owner } = await makeOrg("Org A");
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(orgId, "viewer", "Viewer");
    const leadId = await lead();
    const ownerAct = idOf(
      await actions.createActivity({
        type: "task",
        subject: "Tugas Owner",
        leadId,
        dueLocal: "2099-01-01",
      }),
    );
    actAs(rep);
    const own = await actions.createActivity({
      type: "task",
      subject: "Tugas Rep",
      ownerId: owner.id,
    });
    expect(own.ok).toBe(true);
    expect(
      (await testPrisma.activity.findUniqueOrThrow({ where: { id: idOf(own) } })).ownerId,
    ).toBe(rep.id);
    expect(
      (await q.listActivities(await ctxNow(), { bucket: "upcoming" })).map((a) => a.subject),
    ).toEqual(["Tugas Rep"]);
    expect(await actions.setActivityStatus({ id: ownerAct, status: "done" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteActivity({ id: ownerAct })).toMatchObject({ ok: false });
    actAs(viewer);
    expect(await actions.createActivity({ type: "note", subject: "Viewer" })).toMatchObject({
      ok: false,
    });
    expect(await actions.setActivityStatus({ id: ownerAct, status: "done" })).toMatchObject({
      ok: false,
    });
    expect((await q.listActivities(await ctxNow(), { bucket: "upcoming" })).length).toBeGreaterThan(
      0,
    );
  });

  it("selesai/batal/buka lagi dan hapus tercatat di audit", async () => {
    await makeOrg("Org A");
    const id = idOf(await actions.createActivity({ type: "task", subject: "Tugas status" }));
    expect((await actions.setActivityStatus({ id, status: "done" })).ok).toBe(true);
    expect(
      (await testPrisma.activity.findUniqueOrThrow({ where: { id } })).completedAt,
    ).not.toBeNull();
    expect((await actions.setActivityStatus({ id, status: "open" })).ok).toBe(true);
    expect((await testPrisma.activity.findUniqueOrThrow({ where: { id } })).completedAt).toBeNull();
    expect((await actions.setActivityStatus({ id, status: "cancelled" })).ok).toBe(true);
    expect((await actions.updateActivity({ id, subject: "Tugas diubah" })).ok).toBe(true);
    expect((await actions.deleteActivity({ id })).ok).toBe(true);
    const acts = (await testPrisma.auditLog.findMany({ where: { entityType: "Activity" } })).map(
      (a) => a.action,
    );
    expect(acts).toEqual(
      expect.arrayContaining([
        "activity.created",
        "activity.done",
        "activity.reopened",
        "activity.cancelled",
        "activity.updated",
        "activity.deleted",
      ]),
    );
  });
});

describe("Upcoming / Overdue terhadap zona waktu organisasi", () => {
  it("tenggat tanggal-saja baru terlambat setelah hari itu berakhir di zona organisasi (WIB)", async () => {
    await makeOrg("Org A"); // timezone Asia/Jakarta
    await actions.createActivity({
      type: "task",
      subject: "Jatuh tempo 11 Nov",
      dueLocal: "2026-11-11",
    });
    const ctx = await ctxNow();
    // 11 Nov 20:00 WIB (13:00 UTC) → masih hari yang sama: belum terlambat
    const sameDay = new Date("2026-11-11T13:00:00Z");
    expect(await q.listActivities(ctx, { bucket: "overdue", now: sameDay })).toHaveLength(0);
    expect(await q.listActivities(ctx, { bucket: "upcoming", now: sameDay })).toHaveLength(1);
    // 12 Nov 00:30 WIB (11 Nov 17:30 UTC) → sudah lewat
    const next = new Date("2026-11-11T17:30:00Z");
    expect(await q.listActivities(ctx, { bucket: "overdue", now: next })).toHaveLength(1);
    expect(await q.listActivities(ctx, { bucket: "upcoming", now: next })).toHaveLength(0);
    expect(await q.countOverdue(ctx, next)).toBe(1);
    // selesai → keluar dari overdue, masuk done
    const id = (await q.listActivities(ctx, { bucket: "overdue", now: next }))[0].id;
    await actions.setActivityStatus({ id, status: "done" });
    expect(await q.listActivities(ctx, { bucket: "overdue", now: next })).toHaveLength(0);
    expect(await q.listActivities(ctx, { bucket: "done" })).toHaveLength(1);
  });
});

describe("Integrasi lead & deal", () => {
  it("konversi lead memindahkan tautan aktivitas ke contact & deal hasil konversi", async () => {
    await makeOrg("Org A");
    const leadId = await lead("Lead Konversi");
    const actId = idOf(
      await actions.createActivity({ type: "call", subject: "Telepon awal", leadId }),
    );
    await leadActions.setLeadStatus({ id: leadId, status: "qualified" });
    const { convertLead } = leadActions;
    const res = await convertLead({
      leadId,
      contact: { mode: "create" },
      company: { mode: "none" },
      deal: { create: true },
    });
    expect(res.ok).toBe(true);
    const a = await testPrisma.activity.findUniqueOrThrow({ where: { id: actId } });
    expect(a.contactId).not.toBeNull();
    expect(a.dealId).not.toBeNull();
    expect(a.leadId).toBe(leadId);
  });

  it("papan Kanban: peringatan 'tanpa next activity' hilang bila ada aktivitas terbuka; aktivitas menyegarkan indikator risiko", async () => {
    await makeOrg("Org A");
    const contactId = idOf(await contactActions.createContact({ name: "Kontak Deal" }));
    const dealId = idOf(
      await dealActions.createDeal({
        title: "Deal Warn",
        contactId,
        expectedCloseDate: "2099-01-01",
      }),
    );
    const ctx = await ctxNow();
    const p = await dealQ.getDefaultPipeline(ctx);
    expect((await dealQ.getKanban(ctx, p.id)).cards[0].noNextActivity).toBe(true);
    await actions.createActivity({
      type: "task",
      subject: "Follow up",
      dealId,
      dueLocal: "2099-01-01",
    });
    expect((await dealQ.getKanban(ctx, p.id)).cards[0].noNextActivity).toBe(false);
    // aktivitas selesai tidak dihitung sebagai next activity
    const a = await testPrisma.activity.findFirstOrThrow({ where: { dealId } });
    await actions.setActivityStatus({ id: a.id, status: "done" });
    expect((await dealQ.getKanban(ctx, p.id)).cards[0].noNextActivity).toBe(true);
  });
});
