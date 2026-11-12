import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
process.env.ALLOW_PRIVATE_WEBHOOK_TARGETS = "";

const { redis } = await import("@/lib/redis");
const { closeQueues, getQueue, QUEUES } = await import("@/lib/queue");
const { deliverOutbound, emitBusinessEvent, signBody } = await import("@/lib/outbound-webhooks");
const { OUTBOUND_EVENTS } = await import("@/modules/integrations/constants");
const hooks = await import("@/modules/integrations/server/webhook-actions");
const leadA = await import("@/modules/leads/server/actions");
const dealA = await import("@/modules/deals/server/actions");
const contactA = await import("@/modules/contacts/server/actions");
const companyA = await import("@/modules/companies/server/actions");
const productA = await import("@/modules/products/server/actions");
const quoA = await import("@/modules/quotations/server/actions");
const { convertLeadService } = await import("@/modules/leads/server/conversion");
const { getTenantContext } = await import("@/lib/context");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const queue = () => getQueue(QUEUES.outbound);
const URL_OK = "https://8.8.8.8/erp-hook";

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

async function erpHook(events: string[] = [...OUTBOUND_EVENTS]) {
  const r = await hooks.createOutboundWebhook({
    provider: "custom",
    name: "ERP",
    url: URL_OK,
    events,
  } as never);
  if (!r.ok) throw new Error(r.error);
  return r.data as { id: string; secret: string };
}
const events = async () =>
  (await testPrisma.outboundDelivery.findMany({ orderBy: { createdAt: "asc" } })).map(
    (d) => d.event,
  );

describe("Event bisnis ERP/POS/akuntansi (plan 3.7)", () => {
  it("aksi bisnis memicu event baru: stage, customer pertama (sekali), quotation accepted/rejected, produk, konversi lead", async () => {
    const o = await makeOrg("Org A");
    await erpHook();
    const company = idOf(await companyA.createCompany({ name: "PT Klien" }));
    const d1 = idOf(await dealA.createDeal({ title: "Deal 1", companyId: company, value: "1000" }));
    const d2 = idOf(await dealA.createDeal({ title: "Deal 2", companyId: company, value: "2000" }));
    const stages = await testPrisma.pipelineStage.findMany({
      where: { organizationId: o.orgId, archivedAt: null },
      orderBy: { position: "asc" },
    });
    await dealA.moveDealStage({ id: d1, stageId: stages[1]!.id });
    await dealA.markDealWon({ id: d1 });
    await dealA.markDealWon({ id: d2 }); // customer sudah ada → tidak ada customer.created kedua

    const p = idOf(await productA.createProduct({ name: "Kasir", price: "100000", sku: "KSR-1" }));
    await productA.updateProduct({
      id: p,
      name: "Kasir Pro",
      price: "150000",
      sku: "KSR-1",
      currency: "IDR",
      isActive: true,
    } as never);

    const dq = idOf(await dealA.createDeal({ title: "Deal Q", companyId: company }));
    const qa = idOf(await quoA.createQuotation({ dealId: dq }));
    const qb = idOf(await quoA.createQuotation({ dealId: dq }));
    for (const [id, st] of [
      [qa, "accepted"],
      [qb, "rejected"],
    ] as const) {
      await testPrisma.quotation.update({ where: { id }, data: { status: "sent" } });
      expect((await quoA.setQuotationStatus({ id, status: st })).ok).toBe(true);
    }

    const lead = idOf(await leadA.createLead({ name: "Lead K", email: "k@x.co" }));
    await testPrisma.lead.update({ where: { id: lead }, data: { status: "qualified" } });
    await convertLeadService(
      { ...(await getTenantContext())!, ip: null, userAgent: null },
      {
        leadId: lead,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      },
    );

    const got = await events();
    const count = (e: string) => got.filter((x) => x === e).length;
    expect(count("deal.stage_changed")).toBe(1);
    expect(count("deal.won")).toBe(2);
    expect(count("customer.created")).toBe(1);
    expect(count("product.created")).toBe(1);
    expect(count("product.updated")).toBe(1);
    expect(count("quotation.accepted")).toBe(1);
    expect(count("quotation.rejected")).toBe(1);
    expect(count("lead.converted")).toBe(1);

    // amplop ber-versi + isi sesuai
    const cust = await testPrisma.outboundDelivery.findFirstOrThrow({
      where: { event: "customer.created" },
    });
    expect(cust.payload).toMatchObject({
      schemaVersion: "1",
      event: "customer.created",
      data: { partyType: "company", partyId: company, firstDealId: d1, firstDealValue: "1000.00" },
    });
    const st = await testPrisma.outboundDelivery.findFirstOrThrow({
      where: { event: "deal.stage_changed" },
    });
    expect(st.payload).toMatchObject({
      data: { id: d1, fromStageId: stages[0]!.id, toStageId: stages[1]!.id },
    });
    void o;
  });

  it("payload yang melanggar skema tidak diantre (kontrak dijaga)", async () => {
    const o = await makeOrg("Org A");
    await erpHook(["lead.created"]);
    await emitBusinessEvent(o.orgId, "lead.created", "lead.created:bad", { id: "1" });
    expect(await testPrisma.outboundDelivery.count()).toBe(0);
    expect((await queue().getJobCounts()).waiting).toBe(0);
  });

  it("header membawa versi skema; tanda tangan HMAC atas timestamp.body dapat diverifikasi", async () => {
    const o = await makeOrg("Org A");
    const { secret } = await erpHook(["product.created"]);
    await productA.createProduct({ name: "Item", price: "5000" });
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    await deliverOutbound({ organizationId: o.orgId, deliveryId: d.id });
    const [, init] = fetchMock.mock.calls[0]!;
    const h = init.headers as Record<string, string>;
    expect(h["x-crm-schema-version"]).toBe("1");
    expect(h["x-crm-event"]).toBe("product.created");
    expect(h["x-crm-signature"]).toBe(
      `sha256=${signBody(secret, h["x-crm-timestamp"]!, init.body as string)}`,
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      schemaVersion: "1",
      event: "product.created",
    });
  });
});

describe("Dead-letter & kirim ulang", () => {
  async function deadDelivery() {
    const o = await makeOrg("Org A");
    const { id } = await erpHook(["product.created"]);
    await productA.createProduct({ name: "Item", price: "5000" });
    const d = await testPrisma.outboundDelivery.findFirstOrThrow();
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    await expect(
      deliverOutbound({ organizationId: o.orgId, deliveryId: d.id }, { final: true }),
    ).rejects.toThrow();
    return { o, hookId: id, deliveryId: d.id };
  }

  it("gagal setelah percobaan terakhir = dead-letter (failed); kirim ulang mengantre lagi dan tercatat di audit", async () => {
    const { o, deliveryId } = await deadDelivery();
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
    ).toMatchObject({ status: "failed", httpStatus: 500 });
    await queue().obliterate({ force: true });
    expect(await hooks.retryOutboundDelivery({ id: deliveryId })).toMatchObject({ ok: true });
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
    ).toMatchObject({ status: "pending", attempts: 0, error: null });
    expect((await queue().getJobCounts()).waiting).toBe(1);
    expect(
      await testPrisma.auditLog.count({ where: { action: "outbound_delivery.retried" } }),
    ).toBe(1);
    // pengiriman ulang berhasil → success, payload/ID event sama (penerima dapat dedupe)
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    await deliverOutbound({ organizationId: o.orgId, deliveryId });
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
    ).toMatchObject({ status: "success" });
    // yang sudah sukses tidak dapat dikirim ulang
    expect(await hooks.retryOutboundDelivery({ id: deliveryId })).toMatchObject({ ok: false });
  });

  it("izin & isolasi: rep tak boleh; endpoint nonaktif ditolak; tenant lain tak dapat mengirim ulang", async () => {
    const { o, hookId, deliveryId } = await deadDelivery();
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(await hooks.retryOutboundDelivery({ id: deliveryId })).toMatchObject({ ok: false });
    actAs(o.owner);
    await testPrisma.outboundWebhook.update({ where: { id: hookId }, data: { isActive: false } });
    expect(await hooks.retryOutboundDelivery({ id: deliveryId })).toMatchObject({ ok: false });
    await testPrisma.outboundWebhook.update({ where: { id: hookId }, data: { isActive: true } });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await hooks.retryOutboundDelivery({ id: deliveryId })).toMatchObject({ ok: false });
    expect(
      await testPrisma.outboundDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
    ).toMatchObject({ status: "failed" });
    void contactA;
  });
});
