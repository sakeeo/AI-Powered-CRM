import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.ALLOW_PRIVATE_WEBHOOK_TARGETS = "";

const { redis } = await import("@/lib/redis");
const { closeQueues, getQueue, QUEUES } = await import("@/lib/queue");
const { getTenantContext } = await import("@/lib/context");
const { decryptSecret } = await import("@/lib/crypto");
const { deliverOutbound, emitBusinessEvent, signBody } = await import("@/lib/outbound-webhooks");
const actions = await import("@/modules/integrations/server/webhook-actions");
const q = await import("@/modules/integrations/server/queries");
const leadActions = await import("@/modules/leads/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");

const ctxNow = async () => (await getTenantContext())!;
const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const queue = () => getQueue(QUEUES.outbound);
const URL_OK = "https://8.8.8.8/hook";

beforeEach(async () => {
  await resetDb();
  fetchMock.mockReset();
  await queue().obliterate({ force: true });
});
afterAll(async () => {
  await queue().obliterate({ force: true });
  await closeQueues();
  await redis.quit();
  await testPrisma.$disconnect();
});

async function hook(over: Record<string, unknown> = {}) {
  const r = await actions.createOutboundWebhook({
    provider: "zapier",
    name: "Zap Satu",
    url: URL_OK,
    events: ["lead.created", "deal.won"],
    ...over,
  } as never);
  if (!r.ok) throw new Error(r.error);
  return r.data as { id: string; secret: string };
}

describe("Konfigurasi webhook keluar", () => {
  it("menolak URL non-HTTPS/privat (SSRF); secret tampil sekali dan terenkripsi", async () => {
    const o = await makeOrg("Org A");
    for (const url of [
      "http://hooks.zapier.com/x",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://192.168.0.2/x",
      "https://169.254.169.254/x",
    ]) {
      expect(
        await actions.createOutboundWebhook({
          provider: "custom",
          name: "Bad",
          url,
          events: ["lead.created"],
        }),
      ).toMatchObject({ ok: false });
    }
    expect(
      await actions.createOutboundWebhook({
        provider: "custom",
        name: "Tanpa event",
        url: URL_OK,
        events: [],
      }),
    ).toMatchObject({ ok: false });
    const { id, secret } = await hook();
    expect(secret).toMatch(/^crmsec_/);
    const view = JSON.stringify(await q.listOutboundWebhooks(await ctxNow()));
    expect(view).not.toContain(secret);
    const row = await testPrisma.outboundWebhook.findUniqueOrThrow({ where: { id } });
    expect(decryptSecret(row.secretEncrypted, `${o.orgId}:outbound_webhook`)).toBe(secret);
    expect(JSON.stringify(await testPrisma.auditLog.findMany())).not.toContain(secret);
    const rot = await actions.rotateOutboundSecret({ id });
    expect((rot as { data: { secret: string } }).data.secret).not.toBe(secret);
  });

  it("izin dan isolasi tenant", async () => {
    const a = await makeOrg("Org A");
    const { id } = await hook();
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(
      await actions.createOutboundWebhook({
        provider: "custom",
        name: "X",
        url: URL_OK,
        events: ["lead.created"],
      }),
    ).toMatchObject({ ok: false });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await q.listOutboundWebhooks(await ctxNow())).toHaveLength(0);
    for (const res of [
      await actions.deleteOutboundWebhook({ id }),
      await actions.rotateOutboundSecret({ id }),
      await actions.testOutboundWebhook({ id }),
      await actions.updateOutboundWebhook({
        id,
        name: "Bajak",
        url: URL_OK,
        events: ["lead.created"],
        isActive: false,
      }),
    ])
      expect(res).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await testPrisma.outboundWebhook.count()).toBe(1);
  });
});

describe("Pengiriman", () => {
  it("event dicatat & diantre sekali per endpoint yang berlangganan; duplikat eventId dan webhook nonaktif diabaikan", async () => {
    const o = await makeOrg("Org A");
    const a = await hook({ name: "Zap A", events: ["lead.created"] });
    await hook({ name: "Zap B", events: ["deal.won"] });
    const c = await hook({ name: "Zap C", events: ["lead.created"] });
    await actions.updateOutboundWebhook({
      id: c.id,
      name: "Zap C",
      url: URL_OK,
      events: ["lead.created"],
      isActive: false,
    });
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:1", { id: "1" });
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:1", { id: "1" });
    expect(await testPrisma.outboundDelivery.count()).toBe(1);
    expect((await queue().getJobCounts()).waiting).toBe(1);
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    expect(d.webhookId).toBe(a.id);
  });

  it("berhasil: header + tanda tangan HMAC dapat diverifikasi penerima; status success", async () => {
    const o = await makeOrg("Org A");
    const { id, secret } = await hook();
    await emitBusinessEvent(o.orgId, "deal.won", "deal.won:9:1", { id: "9", title: "Deal" });
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    await deliverOutbound({ organizationId: o.orgId, deliveryId: d.id });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(URL_OK);
    expect(init.headers["x-crm-event"]).toBe("deal.won");
    const ts = init.headers["x-crm-timestamp"];
    expect(init.headers["x-crm-signature"]).toBe(`sha256=${signBody(secret, ts, init.body)}`);
    expect(JSON.parse(init.body)).toMatchObject({ event: "deal.won", data: { id: "9" } });
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: d.id } }),
    ).toMatchObject({ status: "success", attempts: 1, httpStatus: 200 });
    expect(
      (await testPrisma.outboundWebhook.findUniqueOrThrow({ where: { id } })).lastDeliveryAt,
    ).not.toBeNull();
    // job diulang setelah sukses → tidak kirim lagi
    await deliverOutbound({ organizationId: o.orgId, deliveryId: d.id });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gagal: melempar agar di-retry, tetap pending; percobaan terakhir → failed", async () => {
    const o = await makeOrg("Org A");
    await hook();
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:2", { id: "2" });
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    await expect(deliverOutbound({ organizationId: o.orgId, deliveryId: d.id })).rejects.toThrow(
      /500/,
    );
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: d.id } }),
    ).toMatchObject({ status: "pending", attempts: 1, httpStatus: 500 });
    await expect(
      deliverOutbound({ organizationId: o.orgId, deliveryId: d.id }, { final: true }),
    ).rejects.toThrow();
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: d.id } }),
    ).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("URL berubah menjadi privat/non-HTTPS di DB → gagal terminal tanpa fetch; webhook nonaktif tidak mengirim", async () => {
    const o = await makeOrg("Org A");
    const { id } = await hook();
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:3", { id: "3" });
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    await testPrisma.outboundWebhook.update({
      where: { id },
      data: { url: "https://10.0.0.1/internal" },
    });
    await deliverOutbound({ organizationId: o.orgId, deliveryId: d.id });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: d.id } }),
    ).toMatchObject({ status: "failed" });
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:4", { id: "4" });
    await testPrisma.outboundWebhook.update({ where: { id }, data: { isActive: false } });
    const d2 = await testPrisma.outboundDelivery.findFirstOrThrow({
      where: { eventId: "lead.created:4" },
    });
    await deliverOutbound({ organizationId: o.orgId, deliveryId: d2.id });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Kirim uji (ping) memakai jalur yang sama dan melaporkan hasil", async () => {
    await makeOrg("Org A");
    const { id } = await hook();
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    expect(await actions.testOutboundWebhook({ id })).toMatchObject({
      ok: true,
      data: { ok: true },
    });
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 404 }));
    expect(await actions.testOutboundWebhook({ id })).toMatchObject({
      ok: true,
      data: { ok: false },
    });
  });

  it("aksi bisnis memicu event; payload memakai whitelist (catatan internal tidak ikut); lintas tenant tidak bocor", async () => {
    const a = await makeOrg("Org A");
    await hook({
      events: ["lead.created", "contact.created", "deal.created", "deal.won", "deal.lost"],
    });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    await hook({ name: "Zap B", events: ["lead.created"] });
    actAs(a.owner);
    await leadActions.createLead({
      name: "Lead Rahasia",
      notes: "CATATAN-INTERNAL",
      email: "x@y.com",
    });
    const c = idOf(await contactActions.createContact({ name: "Kontak A" }));
    const d = idOf(await dealActions.createDeal({ title: "Deal A", contactId: c, value: "500" }));
    await dealActions.markDealWon({ id: d });
    const rows = await testPrisma.outboundDelivery.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.event).sort()).toEqual([
      "contact.created",
      "deal.created",
      "deal.won",
      "lead.created",
    ]);
    expect(rows.every((r) => r.organizationId === a.orgId)).toBe(true);
    const leadRow = rows.find((r) => r.event === "lead.created")!;
    const json = JSON.stringify(leadRow.payload);
    expect(json).toContain("Lead Rahasia");
    expect(json).not.toContain("CATATAN-INTERNAL");
    expect(rows.find((r) => r.event === "deal.won")!.payload).toMatchObject({
      data: { status: "won", value: "500.00" },
    });
    expect((await queue().getJobCounts()).waiting).toBe(4);
  });
});
