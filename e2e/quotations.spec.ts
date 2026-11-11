import { expect, test } from "@playwright/test";

test("quotation: buat, isi item, total akurat, kirim, dan unduh PDF", async ({ page }) => {
  const stamp = Date.now() % 100000;
  await page.goto("/quotations");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Quotation baru" }).first().click();
  await page.getByLabel("Judul (opsional)").fill(`Penawaran ${stamp}`);
  await page.getByRole("button", { name: "Buat draft" }).click();
  await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]+$/);
  await expect(page.getByText(/^QUO-\d{4}-\d{4}$/).first()).toBeVisible();

  await page.getByRole("button", { name: "Item kustom" }).click();
  await page.getByLabel("Nama item 1").fill("Jasa implementasi");
  await page.getByLabel("Jumlah 1").fill("2");
  await page.getByLabel("Harga satuan 1").fill("1000000");
  await page.getByLabel("Diskon % 1").fill("10");
  // 2.000.000 − 10% = 1.800.000; pajak (default 11%) 198.000 → 1.998.000
  await expect(page.getByTestId("grand-total")).toContainText("1.998.000");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Quotation disimpan")).toBeVisible();

  await page.getByRole("button", { name: "Tandai terkirim" }).click();
  await expect(page.getByText("Status: Sent")).toBeVisible();
  await expect(page.getByLabel("Nama item 1")).toBeDisabled();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Unduh PDF/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^QUO-\d{4}-\d{4}\.pdf$/);
  await expect(page.getByText(/bukan faktur pajak/)).toBeVisible();

  await page.goto("/settings/quotations");
  await expect(page.getByLabel("Label pajak")).toBeVisible();
});
