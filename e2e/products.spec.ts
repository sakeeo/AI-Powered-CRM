import { expect, test } from "@playwright/test";

test("produk: buat di katalog lalu pilih pada deal", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const product = `Produk ${stamp}`;
  const contact = `Kontak Produk ${stamp}`;

  await page.goto("/products");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah produk" }).first().click();
  await page.getByLabel("Nama produk/layanan").fill(product);
  await page.getByLabel("Harga", { exact: true }).fill("2500000");
  await page.getByLabel("Kategori", { exact: true }).fill("Software");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("cell", { name: product, exact: true })).toBeVisible();

  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah contact" }).first().click();
  await page.getByLabel("Nama", { exact: true }).fill(contact);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

  await page.goto("/deals");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah deal" }).first().click();
  await page.getByLabel("Judul deal").fill(`Deal Produk ${stamp}`);
  await page.getByLabel("Contact").click();
  await page.getByRole("option", { name: contact }).click();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);

  await page.locator("#deal-product").click();
  await page.getByRole("option", { name: new RegExp(product) }).click();
  await page.getByLabel("Jumlah", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(page.getByTestId("deal-products")).toContainText(product);
  await expect(page.getByText(/Total:/)).toContainText("5.000.000");
});
