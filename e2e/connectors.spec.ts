import { expect, test } from "@playwright/test";

test("Connector Hub: key AI tersimpan bermasker dan tidak pernah tampil utuh", async ({ page }) => {
  await page.goto("/settings/connectors");
  await page.waitForLoadState("networkidle");

  await page
    .getByTestId("catalog-ai-openai")
    .getByRole("button", { name: /Hubungkan|Kelola/ })
    .click();
  await page.getByLabel("API key").fill("sk-e2e-SECRET-0000-abcd");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("OpenAI disimpan")).toBeVisible();
  await page.getByRole("tab", { name: /Terhubung/ }).click();

  await expect(page.getByText("sk-...abcd")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("SECRET-0000");
  expect(await page.content()).not.toContain("SECRET-0000");
});
