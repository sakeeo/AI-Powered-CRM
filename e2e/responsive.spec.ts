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

const PAGES = [
  "/leads",
  "/contacts",
  "/companies",
  "/deals",
  "/deals?view=board",
  "/activities",
  "/calendar",
  "/products",
  "/quotations",
  "/customers",
  "/feedback",
  "/reports",
  "/notifications",
  "/settings/connectors",
  "/settings/quotations",
  "/settings/tags",
  "/settings/custom-fields",
  "/settings/automation",
  "/inbox",
  "/settings/integrations",
];
for (const [name, width, height] of [
  ["smartphone", 375, 812],
  ["tablet", 768, 1024],
] as const) {
  test(`semua halaman utama tanpa overflow horizontal (${name} ${width}px)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflow di ${width}px`).toBe(false);
    }
  });
}
