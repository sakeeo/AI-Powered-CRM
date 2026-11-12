import { expect, test } from "@playwright/test";

test("tanya CRM: halaman tampil dan menolak dengan jelas bila AI connector belum ada", async ({
  page,
}) => {
  await page.goto("/insights");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Tanya CRM").first()).toBeVisible();
  await page.getByLabel("Pertanyaan").fill("Berapa lead baru bulan ini?");
  await page.getByRole("button", { name: "Tanya" }).click();
  await expect(page.getByText(/AI connector/i).first()).toBeVisible();
});
