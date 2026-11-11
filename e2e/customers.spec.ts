import { expect, test } from "@playwright/test";

test("deal Won otomatis menjadi customer; Customer 360, segmen, dan feedback", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const contact = `Pelanggan ${stamp}`;
  const deal = `Deal Won ${stamp}`;

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
  await page.getByLabel("Nilai deal").fill("3000000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);

  // belum Won → belum customer
  await page.goto("/customers");
  await page.getByLabel("Cari data").fill(contact);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: contact })).toHaveCount(0);

  await page.goto("/deals");
  await page.getByRole("link", { name: deal }).click();
  await page.getByRole("button", { name: "Won", exact: true }).click();
  await expect(page.getByText("Deal ditandai Won")).toBeVisible();

  await page.goto("/customers");
  await page.getByLabel("Cari data").fill(contact);
  await expect(page).toHaveURL(/q=/);
  await page.getByRole("link", { name: contact }).click();
  await expect(page).toHaveURL(/\/customers\/contact\/[0-9a-f-]+$/);
  await expect(page.getByTestId("total-spend")).toContainText("3.000.000");
  await expect(page.getByTestId("customer-deals")).toContainText(deal);

  await page.getByLabel("Segmen baru").fill("VIP");
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(page.getByTestId("segments")).toContainText("VIP");

  await page.getByRole("button", { name: /Catat feedback/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Judul").fill(`Pengiriman telat ${stamp}`);
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByTestId("customer-feedback")).toContainText(`Pengiriman telat ${stamp}`);
});
