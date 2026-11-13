import { expect, test } from "@playwright/test";

test("impor CSV: pemetaan kolom, laporan baris error, lalu export", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const csv = [
    "Nama,Email,Telp",
    `Impor Satu ${stamp},satu${stamp}@x.com,0812000111`,
    `Impor Dua ${stamp},bukan-email,`,
    `Impor Tiga ${stamp},,0812000333`,
  ].join("\n");

  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Impor CSV" }).click();
  await page
    .getByLabel("Berkas CSV")
    .setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("3 baris terbaca")).toBeVisible();
  await page.getByRole("button", { name: "Impor 3 baris" }).click();
  const result = page.getByTestId("import-result");
  await expect(result).toContainText("2 lead berhasil diimpor");
  await expect(result).toContainText("Baris 3");
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("link", { name: `Impor Satu ${stamp}` })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("menuitem", { name: /CSV/ }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("webhook: buat, secret tampil sekali, rotasi", async ({ page }) => {
  await page.goto("/settings/connectors");
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId("catalog-webhook-in")
    .getByRole("button", { name: /Hubungkan|Kelola/ })
    .click();
  const create = page.getByRole("button", { name: /Buat webhook|Rotasi secret/ });
  await create.click();
  await expect(page.getByTestId("webhook-secret")).toContainText("whsec_");
  await expect(page.getByTestId("webhook-url")).toContainText("/api/webhooks/inbound/");
  await page.reload();
  await expect(page.getByTestId("webhook-secret")).toHaveCount(0);
  await expect(page.getByText("whsec_...")).toBeVisible();
});
