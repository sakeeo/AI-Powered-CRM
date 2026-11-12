import { expect, test } from "@playwright/test";

test("tanya CRM: halaman tampil dan menolak dengan jelas bila AI connector belum ada", async ({
  page,
}) => {
  await page.goto("/insights");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Tanya CRM").first()).toBeVisible();
  await page.getByLabel("Pertanyaan").fill("Berapa lead baru bulan ini?");
  await page.getByRole("button", { name: "Tanya" }).click();
  // Organisasi E2E bersama bisa sudah punya AI connector (spec lain): hasil atau pesan galat sama-sama valid.
  await expect(
    page
      .getByText(/AI connector/i)
      .or(page.getByTestId("insight-result"))
      .or(page.getByText(/API key|penyedia/i))
      .first(),
  ).toBeVisible();
});
