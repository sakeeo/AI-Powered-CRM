import { expect, test } from "@playwright/test";

test("report builder: susun, jalankan, simpan; segmen dinamis dibuat dari aturan", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  await page.goto("/reports/builder");
  await page.waitForLoadState("networkidle");
  await page.locator("#rb-entity").click();
  await page.getByRole("option", { name: "deal" }).click();
  await page.locator("#rb-group").click();
  await page.getByRole("option", { name: "Status" }).click();
  await page.locator("#rb-period").click();
  await page.getByRole("option", { name: "sepanjang waktu" }).click();
  await page.getByRole("button", { name: "Jalankan" }).click();
  await expect(page.getByTestId("builder-result")).toBeVisible();
  await page.getByLabel("Nama laporan").fill(`Deal per status ${stamp}`);
  await page.getByRole("button", { name: "Simpan laporan" }).click();
  await expect(page.getByTestId("saved-reports")).toContainText(`Deal per status ${stamp}`);

  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Segmen baru" }).click();
  await page.getByLabel("Nama segmen").fill(`Besar ${stamp}`);
  await page.getByLabel("Total belanja ≥").fill("1000000");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByTestId("dynamic-segments-list")).toContainText(`Besar ${stamp}`);

  await page.goto("/reports?type=segment");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ringkasan per segmen")).toBeVisible();
  await expect(page.getByTestId("report-table")).toContainText(`Besar ${stamp}`);
});
