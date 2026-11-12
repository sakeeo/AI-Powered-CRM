import { expect, test } from "@playwright/test";

test("integrasi: webhook keluar Zapier dibuat (secret sekali, URL privat ditolak) dan kartu Google tampil", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  await page.goto("/settings/connectors");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah webhook" }).click();
  await page.getByLabel("Nama", { exact: true }).fill(`Zap ${stamp}`);
  await page.getByLabel("URL (HTTPS)").fill("https://127.0.0.1/hook");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/privat|tidak diizinkan/i);
  await page.getByLabel("URL (HTTPS)").fill("https://8.8.8.8/hook");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByTestId("outbound-secret")).toContainText("crmsec_");
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByTestId("outbound-list")).toContainText(`Zap ${stamp}`);

  await page.goto("/settings/integrations");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Google Calendar & Gmail").first()).toBeVisible();
});
