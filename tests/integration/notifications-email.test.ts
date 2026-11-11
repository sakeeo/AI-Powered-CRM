import { Worker, type ConnectionOptions } from "bullmq";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { mails } from "../helpers/mails";

const transport = vi.hoisted(() => ({ sendViaConnector: vi.fn() }));
vi.mock("@/lib/email-transport", () => transport);

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { scanReminders } = await import("@/lib/reminders");
const queue = await import("@/lib/queue");
const mailer = await vi.importActual<typeof import("@/lib/mailer")>("@/lib/mailer");
const emailActions = await import("@/modules/connectors/server/email-actions");
const notifActions = await import("@/modules/notifications/server/actions");
const notifQ = await import("@/modules/notifications/server/queries");
const activityActions = await import("@/modules/activities/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;

beforeEach(async () => {
  await resetDb();
  mails.length = 0;
  transport.sendViaConnector.mockReset();
  await queue.getQueue(queue.QUEUES.mail).obliterate({ force: true });
});
afterAll(async () => {
  await queue.closeQueues();
  await redis.quit();
  await testPrisma.$disconnect();
});

const NOW = new Date("2026-11-11T05:00:00Z");
const wib = (local: string) => local; // dueLocal diinterpretasi zona organisasi (Asia/Jakarta)

describe("Job reminder", () => {
  async function setup() {
    const org = await makeOrg("Org A");
    return org;
  }

  it("membuat notifikasi due_soon & overdue sekali saja; pemindaian ulang tidak menggandakan notifikasi/email", async () => {
    const { orgId, owner } = await setup();
    // 12:20 WIB = 05:20 UTC → 20 menit lagi (due soon); 10:00 WIB = 03:00 UTC → terlambat
    await activityActions.createActivity({
      type: "task",
      subject: "Segera",
      dueLocal: wib("2026-11-11T12:20"),
    });
    await activityActions.createActivity({
      type: "task",
      subject: "Lewat",
      dueLocal: wib("2026-11-11T10:00"),
    });
    await activityActions.createActivity({
      type: "task",
      subject: "Masih lama",
      dueLocal: wib("2026-11-20T10:00"),
    });
    const first = await scanReminders(NOW);
    expect(first).toEqual({ created: 2, emailed: 2 });
    const second = await scanReminders(NOW);
    expect(second).toEqual({ created: 0, emailed: 0 });
    await scanReminders(new Date(NOW.getTime() + 60_000));
    const rows = await testPrisma.notification.findMany({
      where: { organizationId: orgId },
      orderBy: { title: "asc" },
    });
    expect(rows.map((r) => [r.type, r.userId === owner.id])).toEqual([
      ["activity_due_soon", true],
      ["activity_overdue", true],
    ]);
    expect(mails).toHaveLength(2);
    expect(mails.map((m) => m.to)).toEqual([owner.email, owner.email]);
  });

  it("task yang sama berubah dari due_soon menjadi overdue = satu reminder baru; selesai/dibatalkan tidak diingatkan", async () => {
    await setup();
    const id = idOf(
      await activityActions.createActivity({
        type: "task",
        subject: "Bertahap",
        dueLocal: wib("2026-11-11T12:20"),
      }),
    );
    await scanReminders(NOW);
    await scanReminders(new Date("2026-11-11T05:40:00Z")); // sudah lewat
    expect(await testPrisma.notification.count()).toBe(2);
    const done = idOf(
      await activityActions.createActivity({
        type: "task",
        subject: "Selesai",
        dueLocal: wib("2026-11-11T10:00"),
      }),
    );
    await activityActions.setActivityStatus({ id: done, status: "done" });
    await scanReminders(new Date("2026-11-11T05:41:00Z"));
    expect(await testPrisma.notification.count()).toBe(2);
    void id;
  });

  it("menghormati preferensi: email mati → tidak ada email; in-app mati → langsung dianggap terbaca", async () => {
    const { orgId, owner } = await setup();
    await notifActions.setNotificationPreferences({ inApp: false, email: false });
    await activityActions.createActivity({
      type: "task",
      subject: "Diam-diam",
      dueLocal: wib("2026-11-11T10:00"),
    });
    expect(await scanReminders(NOW)).toEqual({ created: 1, emailed: 0 });
    const n = await testPrisma.notification.findFirstOrThrow({ where: { organizationId: orgId } });
    expect(n.readAt).not.toBeNull();
    expect(mails).toHaveLength(0);
    expect(owner.id).toBe(n.userId);
  });

  it("notifikasi hanya milik pemilik task; tandai dibaca hanya untuk milik sendiri", async () => {
    const { orgId, owner } = await setup();
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    actAs(rep);
    await activityActions.createActivity({
      type: "task",
      subject: "Milik Rep",
      dueLocal: wib("2026-11-11T10:00"),
    });
    await scanReminders(NOW);
    const repCtx = (await getTenantContext())!;
    expect(await notifQ.countUnread(repCtx)).toBe(1);
    actAs(owner);
    const ownerCtx = (await getTenantContext())!;
    expect(await notifQ.countUnread(ownerCtx)).toBe(0);
    const n = await testPrisma.notification.findFirstOrThrow({});
    await notifActions.markNotificationRead({ id: n.id }); // milik rep → tidak berefek
    expect(
      (await testPrisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt,
    ).toBeNull();
    actAs(rep);
    await notifActions.markNotificationRead({ id: n.id });
    expect(
      (await testPrisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt,
    ).not.toBeNull();
  });
});

describe("Connector email & pengiriman", () => {
  const smtp = {
    provider: "smtp",
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "akun",
    pass: "RAHASIA-SMTP-123",
    from: "CRM <noreply@example.com>",
  } as const;

  it("disimpan terenkripsi, tidak membocorkan rahasia, dan hanya Owner/Admin yang boleh mengelola", async () => {
    const { orgId } = await makeOrg("Org A");
    expect((await emailActions.saveEmailConnector(smtp)).ok).toBe(true);
    const row = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { type: "email_smtp" },
    });
    expect(row.configEncrypted).not.toContain("RAHASIA");
    expect(JSON.stringify(row.settings)).not.toContain("RAHASIA");
    expect(row.maskedHint).toBe("akun@smtp.example.com");
    expect(JSON.stringify(await testPrisma.auditLog.findMany())).not.toContain("RAHASIA");
    // ubah tanpa password → password lama dipertahankan
    expect(
      (await emailActions.saveEmailConnector({ ...smtp, pass: undefined, port: 465 })).ok,
    ).toBe(true);
    await emailActions.testEmailConnector({ provider: "smtp" });
    expect(transport.sendViaConnector.mock.calls[0][0].config).toMatchObject({
      pass: "RAHASIA-SMTP-123",
      port: 465,
    });
    // validasi: Resend tanpa key
    expect(
      await emailActions.saveEmailConnector({ provider: "resend", from: "a@b.com" }),
    ).toMatchObject({ ok: false });
    for (const role of ["sales_manager", "sales_rep", "viewer"] as const) {
      actAs(await addUserWithRole(orgId, role, role));
      expect(await emailActions.saveEmailConnector(smtp)).toMatchObject({ ok: false });
      expect(await emailActions.testEmailConnector({ provider: "smtp" })).toMatchObject({
        ok: false,
      });
    }
  });

  it("test koneksi mengirim email uji ke pengguna dan mencatat hasil/kegagalan tanpa membocorkan rahasia", async () => {
    const { owner } = await makeOrg("Org A");
    await emailActions.saveEmailConnector(smtp);
    transport.sendViaConnector.mockResolvedValueOnce(undefined);
    const ok = await emailActions.testEmailConnector({ provider: "smtp" });
    expect(ok).toMatchObject({ ok: true, data: { ok: true } });
    expect(transport.sendViaConnector.mock.calls[0][1].to).toBe(owner.email);
    transport.sendViaConnector.mockRejectedValueOnce(
      new Error("auth gagal untuk RAHASIA-SMTP-123"),
    );
    const bad = await emailActions.testEmailConnector({ provider: "smtp" });
    expect(JSON.stringify(bad)).not.toContain("RAHASIA");
    const row = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { type: "email_smtp" },
    });
    expect(row).toMatchObject({ status: "error", lastTestOk: false });
  });

  it("sendMail memakai connector organisasi penerima; job di-retry (exponential backoff) sampai berhasil dan tidak terkirim ganda", async () => {
    const { owner } = await makeOrg("Org A");
    await emailActions.saveEmailConnector(smtp);
    let attempts = 0;
    transport.sendViaConnector.mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error("SMTP sementara down");
    });
    const worker = new Worker(queue.QUEUES.mail, (job) => mailer.deliverMail(job.data), {
      connection: queue.createQueueConnection() as unknown as ConnectionOptions,
      concurrency: 1,
    });
    try {
      // penerima = pengguna terdaftar → organisasi ditemukan dari keanggotaan (alur reset password)
      await mailer.sendMail(
        { to: owner.email, subject: "Reset password", text: "tautan" },
        { backoffMs: 50 },
      );
      await vi.waitFor(() => expect(attempts).toBe(3), { timeout: 8000, interval: 50 });
      await new Promise((r) => setTimeout(r, 500));
      expect(attempts).toBe(3); // sukses di percobaan ke-3, tidak diulang
      expect(transport.sendViaConnector.mock.calls[2][1]).toMatchObject({
        to: owner.email,
        subject: "Reset password",
      });
      expect(transport.sendViaConnector.mock.calls[2][0].type).toBe("email_smtp");
    } finally {
      await worker.close();
    }
  });

  it("tanpa connector: tidak diantrekan & tidak dikirim (development hanya log)", async () => {
    const { owner } = await makeOrg("Org A");
    await mailer.sendMail({ to: owner.email, subject: "Tanpa connector", text: "x" });
    expect(transport.sendViaConnector).not.toHaveBeenCalled();
    expect(await queue.getQueue(queue.QUEUES.mail).count()).toBe(0);
  });
});
