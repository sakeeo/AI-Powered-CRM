import { expect, test } from "@playwright/test";

test("template aktivitas: dibuat di Settings lalu dipakai di composer lead", async ({ page }) => {
  const stamp = Date.now() % 100000;
  const tpl = `Follow-up demo ${stamp}`;
  await page.goto("/settings/activity-templates");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Template baru" }).click();
  await page.getByLabel("Nama template").fill(tpl);
  await page.getByLabel("Judul aktivitas").fill(`Hubungi setelah demo ${stamp}`);
  await page.getByLabel("Tenggat (hari sejak dipakai)").fill("3");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByTestId("template-list")).toContainText(tpl);

  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(`Lead Template ${stamp}`);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  await page.locator("#act-template").click();
  await page.getByRole("option", { name: tpl }).click();
  await expect(page.getByLabel("Judul")).toHaveValue(`Hubungi setelah demo ${stamp}`);
  await page.getByRole("button", { name: "Buat task", exact: true }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Hubungi setelah demo ${stamp}`);
});
