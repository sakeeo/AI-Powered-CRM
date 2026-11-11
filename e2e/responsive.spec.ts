import { expect, test } from "@playwright/test";

for (const [name, width, height] of [
  ["smartphone", 375, 812],
  ["tablet", 768, 1024],
  ["desktop", 1440, 900],
] as const) {
  test(`layout responsif (${name} ${width}px) tanpa overflow horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("smartphone: sidebar berupa drawer yang dibuka lewat tombol", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "Leads" })).toBeHidden();
  await page
    .getByRole("button", { name: /toggle sidebar/i })
    .first()
    .click();
  await expect(page.getByRole("link", { name: "Leads" })).toBeVisible();
});
