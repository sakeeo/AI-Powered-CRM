import { expect, test } from "@playwright/test";

test("dashboard menampilkan KPI aktual, Action Required, dan grafik; filter periode bekerja", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(`Lead Dash ${stamp}`);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

  await page.goto("/dashboard");
  await expect(page.getByTestId("kpis")).toContainText("Total lead aktif");
  await expect(page.getByTestId("kpis")).toContainText("Nilai pipeline");
  await expect(page.getByTestId("action-required")).toContainText(
    "Lead baru belum ditindaklanjuti",
  );
  await expect(page.getByTestId("action-required")).toContainText("Quotation perlu tindak lanjut");
  await expect(
    page.getByRole("img", { name: "Grafik jumlah deal terbuka per stage" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Grafik lead baru per hari" })).toBeVisible();

  await page.getByRole("combobox", { name: "Periode" }).click();
  await page.getByRole("option", { name: "7 hari terakhir" }).click();
  await expect(page).toHaveURL(/period=7d/);
  await expect(page.getByText("7 hari terakhir").first()).toBeVisible();
});
