import { expect, test } from "@playwright/test";

test("deal: buat dengan contact, ubah stage, dan konfigurasi stage pipeline", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const contact = `Kontak Deal ${stamp}`;
  const deal = `Deal ${stamp}`;

  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah contact" }).first().click();
  await page.getByLabel("Nama", { exact: true }).fill(contact);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

  await page.goto("/deals");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah deal" }).first().click();
  await page.getByLabel("Judul deal").fill(deal);
  await page.getByLabel("Contact").click();
  await page.getByRole("option", { name: contact }).click();
  await page.getByLabel("Nilai deal").fill("7500000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: deal })).toBeVisible();
  await expect(page.getByText("Rp 7.500.000").first()).toBeVisible();

  // pindah stage lewat selector
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Needs Analysis" }).click();
  await expect(page.getByText("Stage diperbarui")).toBeVisible();

  // related deals di halaman contact
  await page.goto("/contacts");
  await page.getByLabel("Cari data").fill(contact);
  await page.getByRole("link", { name: contact }).click();
  await expect(page.getByRole("link", { name: deal })).toBeVisible();

  // konfigurasi stage
  await page.goto("/settings/pipelines");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nama stage baru").fill(`Demo ${stamp}`);
  await page.getByRole("button", { name: "Tambah stage" }).click();
  await expect(page.getByLabel(/Nama stage \d+/).last()).toHaveValue(`Demo ${stamp}`);
});
