import { expect, test } from "@playwright/test";

test("konversi lead Qualified menjadi contact, company, dan deal", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const name = `Lead Konversi ${stamp}`;
  const company = `PT Konversi ${stamp}`;

  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(name);
  await page.getByLabel("Perusahaan").fill(company);
  await page.getByLabel("Budget").fill("12000000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

  // belum Qualified → tombol konversi tidak ada
  await expect(page.getByRole("button", { name: "Konversi" })).toHaveCount(0);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Qualified", exact: true }).click();
  await expect(page.getByText("Status diubah ke Qualified")).toBeVisible();

  await page.getByRole("button", { name: "Konversi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Konversi" }).click();
  await expect(page.getByText("Lead berhasil dikonversi")).toBeVisible();

  await expect(page.getByText("Terkonversi", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deal", exact: true })).toBeVisible();
  await page.goto("/deals");
  await page.getByLabel("Cari data").fill(name);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});
