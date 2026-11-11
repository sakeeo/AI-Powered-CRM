import { expect, test } from "@playwright/test";

test("laporan: tab, filter periode, label revenue jelas, dan export", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("tab", { name: "Won/Lost" })).toBeVisible();
  await expect(page.getByTestId("report-table").first()).toBeVisible();

  await page.getByRole("tab", { name: "Revenue" }).click();
  await expect(page).toHaveURL(/type=revenue/);
  await expect(page.getByTestId("report-note")).toContainText("BUKAN uang yang sudah diterima");

  await page.getByRole("combobox", { name: "Periode" }).click();
  await page.getByRole("option", { name: "90 hari terakhir" }).click();
  await expect(page).toHaveURL(/period=90d/);
  await expect(page).toHaveURL(/type=revenue/);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("menuitem", { name: /CSV/ }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^laporan-revenue-\d{4}-\d{2}-\d{2}\.csv$/);
});
