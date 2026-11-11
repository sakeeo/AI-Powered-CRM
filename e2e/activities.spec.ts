import { expect, test } from "@playwright/test";

test("aktivitas: catat note & task dari lead, tampil di timeline dan halaman Activities", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(`Lead Aktif ${stamp}`);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

  const composer = page.getByRole("form", { name: "Tambah aktivitas" });
  await composer.getByLabel("Judul").fill(`Catatan ${stamp}`);
  await page
    .getByRole("textbox", { name: "Catatan aktivitas" })
    .fill("Pelanggan tertarik paket premium");
  await composer.getByRole("button", { name: "Catat" }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Catatan ${stamp}`);
  await expect(page.getByTestId("timeline")).toContainText("Pelanggan tertarik paket premium");

  await composer.getByRole("radio", { name: "Task" }).click();
  await composer.getByLabel("Judul").fill(`Task ${stamp}`);
  await composer.getByLabel("Tenggat").fill("2099-01-01T10:00");
  await composer.getByRole("button", { name: "Buat task" }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Task ${stamp}`);

  await page.goto("/activities?bucket=upcoming");
  await expect(page.getByTestId("activity-list")).toContainText(`Task ${stamp}`);
  await page.getByRole("button", { name: "Selesai" }).first().click();
  await page.goto("/activities?bucket=done");
  await expect(page.getByTestId("activity-list")).toContainText(`Catatan ${stamp}`);
});
