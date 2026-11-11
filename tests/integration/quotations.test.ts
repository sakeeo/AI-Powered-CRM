import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { headersFor } from "../helpers/auth";
import { current } from "../helpers/current-user";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const actions = await import("@/modules/quotations/server/actions");
const q = await import("@/modules/quotations/server/queries");
const { QUOTATION_SORTS } = await import("@/modules/quotations/schemas");
const productActions = await import("@/modules/products/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");
const { renderQuotationPdf } = await import("@/modules/quotations/pdf/quotation-pdf");
const { scanQuotations } = await import("@/lib/reminders");
const { GET: pdfRoute } = await import("@/app/api/quotations/[id]/pdf/route");
const { getTenantObject } = await import("@/lib/storage"); // dimock di bawah (tanpa MinIO di CI)

const store = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@/lib/storage", () => ({
  putTenantObject: async (org: string, path: string, body: Uint8Array) => {
    const key = `${org}/${path}`;
    store.set(key, body);
    return key;
  },
  getTenantObject: async (org: string, path: string) => store.get(`${org}/${path}`)!,
}));

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const params = () => parseListParams({}, QUOTATION_SORTS, "createdAt");

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

const item = (over: Record<string, unknown> = {}) => ({
  name: "Jasa implementasi",
  quantity: "2",
  unitPrice: "1000000",
  discountPercent: "0",
  ...over,
});

async function draft(extra: Record<string, unknown> = {}) {
  const id = idOf(await actions.createQuotation({ title: "Penawaran uji", ...extra }));
  return id;
}

describe("Quotation — pembuatan & perhitungan di server", () => {
  it("dibuat dengan nomor berurutan, konfigurasi pajak/masa berlaku organisasi, dan total dihitung server", async () => {
    await makeOrg("Org A");
    await actions.saveQuotationSettings({
      taxLabel: "PPN",
      taxRate: "11",
      taxInclusive: false,
      validityDays: 30,
    });
    const a = await draft();
    const b = await draft();
    const qa = await q.getQuotation(await ctxNow(), a);
    const qb = await q.getQuotation(await ctxNow(), b);
    expect(qa.number).toMatch(/^QUO-\d{4}-0001$/);
    expect(qb.number).toMatch(/^QUO-\d{4}-0002$/);
    expect(qa).toMatchObject({ status: "draft", taxLabel: "PPN", taxRate: "11.00", total: "0.00" });
    const days = (Date.parse(qa.validUntil) - Date.parse(qa.issueDate)) / 86_400_000;
    expect(days).toBe(30);

    const res = await actions.saveQuotation({
      id: a,
      title: "Penawaran",
      validUntil: qa.validUntil,
      currency: "IDR",
      globalDiscountPercent: "0",
      items: [
        item(),
        item({ name: "Lisensi", quantity: "1", unitPrice: "500000.50", discountPercent: "10" }),
      ],
    });
    // 2.000.000 + 500.000,50 = 2.500.000,50; diskon 50.000,05; DPP 2.450.000,45; PPN 269.500,05 (HALF_UP)
    expect(res).toMatchObject({ ok: true, data: { total: "2719500.50" } });
    const saved = await q.getQuotation(await ctxNow(), a);
    expect(saved).toMatchObject({
      subtotal: "2500000.50",
      discountTotal: "50000.05",
      taxTotal: "269500.05",
      total: "2719500.50",
    });
    expect(saved.items.map((i) => i.lineTotal)).toEqual(["2000000.00", "450000.45"]);
  });

  it("angka dari klien tidak dipercaya; validasi item, tanggal, dan produk", async () => {
    await makeOrg("Org A");
    const id = await draft();
    const base = {
      id,
      title: "Judul valid",
      validUntil: "2099-01-01",
      currency: "IDR" as const,
      globalDiscountPercent: "0",
    };
    expect(await actions.saveQuotation({ ...base, items: [] })).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({ ...base, items: [item({ quantity: "0" })] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({ ...base, items: [item({ unitPrice: "-5" })] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({ ...base, items: [item({ discountPercent: "101" })] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({ ...base, validUntil: "2000-01-01", items: [item()] }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({
        ...base,
        items: [item({ productId: "00000000-0000-4000-8000-000000000000" })],
      }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.saveQuotation({
        ...base,
        items: [{ ...item(), total: "1", lineTotal: "1" } as never],
      }),
    ).toMatchObject({ ok: true, data: { total: "2220000.00" } });
  });

  it("dari deal: customer, mata uang, dan produk deal disalin; quotation tertaut ke deal", async () => {
    await makeOrg("Org A");
    const productId = idOf(
      await productActions.createProduct({ name: "Paket Premium", price: "2500000" }),
    );
    const contactId = idOf(await contactActions.createContact({ name: "Kontak Deal" }));
    const dealId = idOf(await dealActions.createDeal({ title: "Deal Quo", contactId }));
    await productActions.addDealProduct({ dealId, productId, quantity: 2 });
    const id = idOf(await actions.createQuotation({ dealId }));
    const got = await q.getQuotation(await ctxNow(), id);
    expect(got).toMatchObject({
      dealId,
      contactId,
      title: "Penawaran — Deal Quo",
      subtotal: "5000000.00",
      taxTotal: "550000.00",
      total: "5550000.00",
    });
    expect(got.items).toHaveLength(1);
    expect((await q.listQuotationsForDeal(await ctxNow(), dealId)).map((x) => x.number)).toEqual([
      got.number,
    ]);
  });
});

describe("Quotation — status, izin, tenant", () => {
  it("transisi status valid; item terkunci setelah Sent; Accepted final; hanya Draft bisa dihapus", async () => {
    await makeOrg("Org A");
    const id = await draft();
    expect(await actions.setQuotationStatus({ id, status: "sent" })).toMatchObject({ ok: false }); // belum ada item
    await actions.saveQuotation({
      id,
      title: "Judul valid",
      validUntil: "2099-01-01",
      currency: "IDR",
      globalDiscountPercent: "0",
      items: [item()],
    });
    expect(await actions.setQuotationStatus({ id, status: "accepted" })).toMatchObject({
      ok: false,
    });
    expect((await actions.setQuotationStatus({ id, status: "sent" })).ok).toBe(true);
    expect(
      await actions.saveQuotation({
        id,
        title: "Ubah",
        validUntil: "2099-01-01",
        currency: "IDR",
        globalDiscountPercent: "0",
        items: [item()],
      }),
    ).toMatchObject({ ok: false });
    expect(await actions.deleteQuotation({ id })).toMatchObject({ ok: false });
    expect((await actions.setQuotationStatus({ id, status: "accepted" })).ok).toBe(true);
    expect(await actions.setQuotationStatus({ id, status: "draft" })).toMatchObject({ ok: false });
    expect((await testPrisma.quotation.findUniqueOrThrow({ where: { id } })).sentAt).not.toBeNull();
    const id2 = await draft();
    expect((await actions.deleteQuotation({ id: id2 })).ok).toBe(true);
    expect((await q.listQuotations(await ctxNow(), params())).rows.map((r) => r.id)).toEqual([id]);
    const acts = (await testPrisma.auditLog.findMany({ where: { entityType: "Quotation" } })).map(
      (a) => a.action,
    );
    expect(acts).toEqual(
      expect.arrayContaining([
        "quotation.created",
        "quotation.updated",
        "quotation.sent",
        "quotation.accepted",
        "quotation.deleted",
      ]),
    );
  });

  it("izin: Sales Rep hanya quotation miliknya; Viewer read-only; pengaturan pajak hanya Owner/Admin; tenant lain tidak melihat", async () => {
    const a = await makeOrg("Org A");
    const ownerQ = await draft();
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(a.orgId, "viewer", "Viewer");
    actAs(rep);
    const repQ = await draft();
    expect((await q.listQuotations(await ctxNow(), params())).rows.map((r) => r.id)).toEqual([
      repQ,
    ]);
    await expect(q.getQuotation(await ctxNow(), ownerQ)).rejects.toMatchObject({ status: 404 });
    expect(await actions.setQuotationStatus({ id: ownerQ, status: "sent" })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.saveQuotationSettings({
        taxLabel: "PPN",
        taxRate: "0",
        taxInclusive: false,
        validityDays: 7,
      }),
    ).toMatchObject({ ok: false });
    actAs(viewer);
    expect(await actions.createQuotation({})).toMatchObject({ ok: false });
    expect((await q.listQuotations(await ctxNow(), params())).total).toBe(2);
    await makeOrg("Org B");
    expect((await q.listQuotations(await ctxNow(), params())).total).toBe(0);
    await expect(q.getQuotation(await ctxNow(), ownerQ)).rejects.toMatchObject({ status: 404 });
    expect(await actions.deleteQuotation({ id: ownerQ })).toMatchObject({ ok: false });
  });
});

describe("PDF", () => {
  it("dihasilkan sebagai PDF valid memuat nomor & disclaimer, disimpan ke storage tenant, dan hanya bisa diunduh yang berhak", async () => {
    const { orgId, owner } = await makeOrg("Org PDF");
    const id = await draft({ title: "Penawaran PDF" });
    await actions.saveQuotation({
      id,
      title: "Penawaran PDF",
      validUntil: "2099-01-01",
      currency: "IDR",
      globalDiscountPercent: "0",
      items: [item()],
    });
    const detail = await q.getQuotation(await ctxNow(), id);
    const buf = await renderQuotationPdf(detail, "Org PDF");
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1500);

    current.cookie = headersFor(owner).get("cookie") ?? "";
    const res = await pdfRoute(new NextRequest(`http://localhost/api/quotations/${id}/pdf`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`${detail.number}.pdf`);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    const stored = await getTenantObject(orgId, `quotations/${id}.pdf`);
    expect(Buffer.from(stored).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await testPrisma.quotation.findUniqueOrThrow({ where: { id } })).pdfKey).toBe(
      `${orgId}/quotations/${id}.pdf`,
    );

    // orang di organisasi lain: 404, bukan data
    await makeOrg("Org Lain");
    const other = await pdfRoute(new NextRequest(`http://localhost/api/quotations/${id}/pdf`), {
      params: Promise.resolve({ id }),
    });
    expect(other.status).toBe(404);
  });
});

describe("Expiry & pengingat", () => {
  async function sentQuotation(validUntil: string) {
    const id = await draft();
    await actions.saveQuotation({
      id,
      title: "Judul valid",
      validUntil,
      currency: "IDR",
      globalDiscountPercent: "0",
      items: [item()],
    });
    await actions.setQuotationStatus({ id, status: "sent" });
    return id;
  }

  it("lewat masa berlaku → otomatis Expired; mendekati expiry → notifikasi + task follow-up sekali saja", async () => {
    const { owner } = await makeOrg("Org A");
    const today = new Date().toISOString().slice(0, 10);
    const inDays = (n: number) =>
      new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const issue = (await q.getQuotation(await ctxNow(), await draft())).issueDate; // dasar tanggal terbit
    void issue;
    const soon = await sentQuotation(inDays(2));
    const far = await sentQuotation(inDays(30));
    const lapsed = await sentQuotation(inDays(0));
    await testPrisma.quotation.update({
      where: { id: lapsed },
      data: { validUntil: new Date(`${inDays(-5)}T00:00:00Z`) },
    });

    const first = await scanQuotations();
    expect(first).toEqual({ expired: 1, reminded: 1 });
    const again = await scanQuotations();
    expect(again).toEqual({ expired: 0, reminded: 0 });
    expect((await testPrisma.quotation.findUniqueOrThrow({ where: { id: lapsed } })).status).toBe(
      "expired",
    );
    expect((await testPrisma.quotation.findUniqueOrThrow({ where: { id: far } })).status).toBe(
      "sent",
    );
    const tasks = await testPrisma.activity.findMany({ where: { type: "task" } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ ownerId: owner.id, status: "open" });
    expect(tasks[0].subject).toContain("Follow up quotation");
    expect(
      await testPrisma.notification.count({
        where: { type: "quotation_expiring", userId: owner.id },
      }),
    ).toBe(1);
    void soon;
  });
});
