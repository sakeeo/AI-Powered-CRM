import { expect, test } from "@playwright/test";

test("aksi per item: ikon + label di desktop, hanya ikon (40px) di mobile/tablet", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings/tags");
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("Nama tag baru")
    .fill(`tag${stamp}`)
    .catch(() => undefined);
  await page.goto("/settings/activity-templates");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Template baru" }).click();
  await page.getByLabel("Nama template").fill(`Tpl ${stamp}`);
  await page.getByLabel("Judul aktivitas").fill(`Judul ${stamp}`);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  const row = page.getByTestId("template-list").locator("li", { hasText: `Tpl ${stamp}` });
  const edit = row.getByRole("button", { name: "Ubah" });
  await expect(edit).toBeVisible();
  expect((await edit.boundingBox())!.width).toBeGreaterThan(60); // desktop: ikon + teks

  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await edit.boundingBox();
    expect(box!.width, `lebar ${width}px`).toBeLessThanOrEqual(44);
    await expect(edit).toHaveAccessibleName("Ubah"); // label tetap ada untuk pembaca layar
    await expect(edit.locator("svg")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});
