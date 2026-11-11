import { expect, test } from "@playwright/test";

test("lead: buat, kualifikasi Unqualified dengan alasan, arsip, dan konfigurasi sumber", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  const name = `Lead ${stamp}`;

  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(name);
  await page.getByLabel("Budget").fill("2500000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Rp 2.500.000")).toBeVisible();

  // Status → Unqualified wajib alasan
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Unqualified" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Alasan wajib diisi/)).toBeVisible();
  await page.getByLabel("Alasan").fill("Budget tidak cukup");
  await page.getByRole("dialog").getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Budget tidak cukup")).toBeVisible();

  // Arsip → hilang dari daftar aktif
  await page.getByRole("button", { name: "Arsipkan" }).click();
  await expect(page.getByText("Lead diarsipkan")).toBeVisible();
  await page.goto("/leads");
  await expect(page.getByRole("link", { name })).toHaveCount(0);

  // Konfigurasi sumber lead
  await page.goto("/settings/lead-sources");
  await page.waitForLoadState("networkidle");
  const src = `Sumber ${stamp}`;
  await page.getByLabel("Nama sumber baru").fill(src);
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(page.getByText(src)).toBeVisible();
});
