import { expect, test } from "@playwright/test";

test("kalender menampilkan aktivitas berjadwal", async ({ page }) => {
  const stamp = Date.now() % 100000;
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(`Lead Kalender ${stamp}`);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const due = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T10:00`;
  const composer = page.getByRole("form", { name: "Tambah aktivitas" });
  await composer.getByRole("radio", { name: "Meeting" }).click();
  await composer.getByLabel("Judul").fill(`Meeting Kal ${stamp}`);
  await composer.getByLabel(/Jadwal/).fill(due);
  await composer.getByRole("button", { name: "Catat" }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Meeting Kal ${stamp}`);

  await page.goto("/calendar");
  await expect(page.getByTestId("calendar")).toBeVisible();
  await expect(page.getByText(`Meeting Kal ${stamp}`)).toBeVisible();
  await page.getByRole("button", { name: "Minggu" }).click();
  await expect(page.getByText(`Meeting Kal ${stamp}`)).toBeVisible();
});
