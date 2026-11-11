import { expect, test } from "@playwright/test";

/** Alur utama MVP end-to-end: Lead → konversi → Deal → Activity → Quotation → Won → Customer. */
test("alur Lead → Deal → Activity → Quotation → Customer", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const lead = `Lead Flow ${stamp}`;

  // 1. Lead (+ Qualified)
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(lead);
  await page.getByLabel("Budget").fill("4000000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Qualified", exact: true }).click();
  await expect(page.getByText("Status diubah ke Qualified")).toBeVisible();

  // 2. Konversi → contact + deal
  await page.getByRole("button", { name: "Konversi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Konversi" }).click();
  await expect(page.getByText("Lead berhasil dikonversi")).toBeVisible();

  // 3. Deal dari konversi
  await page.goto("/deals");
  await page.getByLabel("Cari data").fill(lead);
  await expect(page).toHaveURL(/q=/);
  await page
    .getByRole("link", { name: new RegExp(lead) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);
  const dealUrl = page.url();

  // 4. Activity pada deal
  const composer = page.getByRole("form", { name: "Tambah aktivitas" });
  await composer.getByLabel("Judul").fill(`Follow up ${stamp}`);
  await composer.getByRole("button", { name: "Catat" }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Follow up ${stamp}`);

  // 5. Quotation dari deal (halaman quotation)
  await page.goto("/quotations");
  await page.getByRole("button", { name: "Quotation baru" }).first().click();
  await page.getByLabel("Judul (opsional)").fill(`Quo Flow ${stamp}`);
  await page.getByRole("button", { name: "Buat draft" }).click();
  await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Item kustom" }).click();
  await page.getByLabel("Nama item 1").fill("Implementasi");
  await page.getByLabel("Harga satuan 1").fill("4000000");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Quotation disimpan")).toBeVisible();

  // 6. Deal Won → Customer muncul otomatis
  await page.goto(dealUrl);
  await page.getByRole("button", { name: "Won", exact: true }).click();
  await expect(page.getByText("Deal ditandai Won")).toBeVisible();
  await page.goto("/customers");
  await page.getByLabel("Cari data").fill(lead);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: new RegExp(lead) })).toBeVisible();
});
