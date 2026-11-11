import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const actions = await import("@/modules/products/server/actions");
const q = await import("@/modules/products/server/queries");
const { PRODUCT_SORTS } = await import("@/modules/products/schemas");
const dealActions = await import("@/modules/deals/server/actions");
const contactActions = await import("@/modules/contacts/server/actions");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const params = (sp = {}) => parseListParams(sp, PRODUCT_SORTS, "name", "asc");

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Katalog produk", () => {
  it("validasi harga: wajib, non-negatif, maks. 2 desimal, tersimpan sebagai Decimal tepat", async () => {
    await makeOrg("Org A");
    expect(await actions.createProduct({ name: "Produk", price: "" })).toMatchObject({ ok: false });
    expect(await actions.createProduct({ name: "Produk", price: "-1" })).toMatchObject({
      ok: false,
    });
    expect(await actions.createProduct({ name: "Produk", price: "10.999" })).toMatchObject({
      ok: false,
    });
    expect(await actions.createProduct({ name: "P", price: "10" })).toMatchObject({ ok: false });
    const ok = await actions.createProduct({
      name: "Paket Kasir",
      price: "1.500.000,50".replace(/\./g, "").replace(",", "."),
      sku: "KSR-1",
      categoryName: "Software",
    });
    expect(ok.ok).toBe(true);
    const list = await q.listProducts(await ctxNow(), params());
    expect(list.rows[0]).toMatchObject({ name: "Paket Kasir", price: "1500000.50", sku: "KSR-1" });
    expect(list.rows[0].category?.name).toBe("Software");
  });

  it("SKU unik per organisasi (case-insensitive), kategori dipakai ulang, soft delete melepas SKU", async () => {
    await makeOrg("Org A");
    const a = idOf(
      await actions.createProduct({
        name: "A produk",
        price: "100",
        sku: "SKU-1",
        categoryName: "Layanan",
      }),
    );
    expect(
      await actions.createProduct({ name: "B produk", price: "100", sku: "sku-1" }),
    ).toMatchObject({ ok: false });
    await actions.createProduct({ name: "C produk", price: "100", categoryName: "layanan" });
    expect(await testPrisma.productCategory.count()).toBe(1);
    await actions.deleteProduct({ id: a });
    expect((await actions.createProduct({ name: "D produk", price: "100", sku: "SKU-1" })).ok).toBe(
      true,
    );
    expect((await q.listProducts(await ctxNow(), params())).rows.map((r) => r.name)).not.toContain(
      "A produk",
    );
  });

  it("aktif/nonaktif, pencarian, dan filter; produk nonaktif tidak bisa dipilih pada deal", async () => {
    await makeOrg("Org A");
    const a = idOf(await actions.createProduct({ name: "Alpha Lisensi", price: "100" }));
    await actions.createProduct({ name: "Beta Layanan", price: "200" });
    await actions.setProductActive({ id: a, isActive: false });
    const ctx = await ctxNow();
    expect(
      (await q.listProducts(ctx, params(), { status: "inactive" })).rows.map((r) => r.name),
    ).toEqual(["Alpha Lisensi"]);
    expect((await q.listProducts(ctx, params({ q: "layanan" }))).rows.map((r) => r.name)).toEqual([
      "Beta Layanan",
    ]);
    expect((await q.listActiveProducts(ctx)).map((p) => p.name)).toEqual(["Beta Layanan"]);
    const contactId = idOf(await contactActions.createContact({ name: "Kontak P" }));
    const dealId = idOf(await dealActions.createDeal({ title: "Deal P", contactId }));
    expect(await actions.addDealProduct({ dealId, productId: a, quantity: 1 })).toMatchObject({
      ok: false,
    });
  });

  it("isolasi tenant & izin: org lain tidak melihat produk; hanya manager ke atas boleh mengubah", async () => {
    const a = await makeOrg("Org A");
    const pid = idOf(await actions.createProduct({ name: "Milik A", price: "100" }));
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    const manager = await addUserWithRole(a.orgId, "sales_manager", "Mgr");
    actAs(rep);
    expect((await q.listProducts(await ctxNow(), params())).total).toBe(1); // rep boleh melihat
    expect(await actions.createProduct({ name: "Dari Rep", price: "1" })).toMatchObject({
      ok: false,
    });
    expect(await actions.setProductActive({ id: pid, isActive: false })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteProduct({ id: pid })).toMatchObject({ ok: false });
    actAs(manager);
    expect((await actions.createProduct({ name: "Dari Manager", price: "1" })).ok).toBe(true);
    await makeOrg("Org B");
    expect((await q.listProducts(await ctxNow(), params())).total).toBe(0);
    expect(await actions.updateProduct({ id: pid, name: "Curian", price: "1" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteProduct({ id: pid })).toMatchObject({ ok: false });
    expect((await testPrisma.product.findUniqueOrThrow({ where: { id: pid } })).name).toBe(
      "Milik A",
    );
  });
});

describe("Produk pada deal", () => {
  async function setup() {
    const org = await makeOrg("Org A");
    const productId = idOf(
      await actions.createProduct({ name: "Paket Premium", price: "2500000", currency: "IDR" }),
    );
    const contactId = idOf(await contactActions.createContact({ name: "Kontak Deal" }));
    const dealId = idOf(
      await dealActions.createDeal({ title: "Deal Produk", contactId, value: "999" }),
    );
    return { ...org, productId, dealId };
  }

  it("menambah item (snapshot harga katalog / override), menghapus, dan nilai deal tidak berubah otomatis", async () => {
    const { productId, dealId } = await setup();
    const a = await actions.addDealProduct({ dealId, productId, quantity: 2 });
    const b = await actions.addDealProduct({
      dealId,
      productId,
      quantity: 1,
      unitPrice: "2000000.50",
    });
    expect(a.ok && b.ok).toBe(true);
    let items = await q.listDealProducts(await ctxNow(), dealId);
    expect(items.map((i) => [i.name, i.quantity, i.unitPrice])).toEqual([
      ["Paket Premium", 2, "2500000.00"],
      ["Paket Premium", 1, "2000000.50"],
    ]);
    // harga katalog berubah → snapshot item lama tetap
    await actions.updateProduct({ id: productId, name: "Paket Premium Baru", price: "3000000" });
    items = await q.listDealProducts(await ctxNow(), dealId);
    expect(items[0]).toMatchObject({ name: "Paket Premium", unitPrice: "2500000.00" });
    expect(
      (await testPrisma.deal.findUniqueOrThrow({ where: { id: dealId } })).value.toFixed(2),
    ).toBe("999.00");
    expect((await actions.removeDealProduct({ id: idOf(a) })).ok).toBe(true);
    expect(await q.listDealProducts(await ctxNow(), dealId)).toHaveLength(1);
    expect(await actions.addDealProduct({ dealId, productId, quantity: 0 })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.addDealProduct({ dealId, productId, quantity: 1, unitPrice: "abc" }),
    ).toMatchObject({ ok: false });
  });

  it("deal tertutup tidak bisa diubah produknya; Sales Rep tidak bisa mengubah deal orang lain; item ikut terhapus dengan produk dihapus (snapshot tetap)", async () => {
    const { orgId, productId, dealId, owner } = await setup();
    await actions.addDealProduct({ dealId, productId, quantity: 1 });
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(await actions.addDealProduct({ dealId, productId, quantity: 1 })).toMatchObject({
      ok: false,
    });
    actAs(owner);
    await actions.deleteProduct({ id: productId });
    expect(await q.listDealProducts(await ctxNow(), dealId)).toHaveLength(1);
    await dealActions.markDealWon({ id: dealId });
    const other = idOf(await actions.createProduct({ name: "Lain", price: "1" }));
    expect(await actions.addDealProduct({ dealId, productId: other, quantity: 1 })).toMatchObject({
      ok: false,
    });
  });
});
