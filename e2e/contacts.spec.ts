import { expect, test } from "@playwright/test";

test("CRUD company dan contact dengan relasi, pencarian, dan hapus", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const company = `PT Uji ${stamp}`;
  const contact = `Budi ${stamp}`;

  // Company: quick add lewat sheet
  await page.goto("/companies");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah company" }).first().click();
  await page.getByLabel("Nama perusahaan").fill(company);
  await page.getByLabel("Industri").fill("Retail");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: company })).toBeVisible();

  // Contact terhubung ke company
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah contact" }).first().click();
  await page.getByLabel("Nama", { exact: true }).fill(contact);
  await page.getByLabel("Email", { exact: true }).fill(`budi${stamp}@example.com`);
  await page.getByLabel(company).check();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
  await expect(page.getByRole("link", { name: company })).toBeVisible();

  // Pencarian di list
  await page.goto("/contacts");
  await page.getByLabel("Cari data").fill(`Budi ${stamp}`);
  await expect(page).toHaveURL(/q=Budi/);
  await expect(page.getByRole("link", { name: contact })).toBeVisible();

  // Ubah lalu hapus
  await page.getByRole("link", { name: contact }).click();
  await page.getByRole("button", { name: "Ubah" }).click();
  await page.getByLabel("Jabatan").fill("Manajer");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Manajer")).toBeVisible();

  await page.getByRole("button", { name: "Hapus" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hapus" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByRole("link", { name: contact })).toHaveCount(0);
});
