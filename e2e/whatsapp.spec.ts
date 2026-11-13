import { expect, test } from "@playwright/test";

test("whatsapp: hubungkan gateway, pesan masuk lewat webhook muncul di inbox dan dapat diambil", async ({
  page,
  request,
}) => {
  const stamp = Date.now() % 1_000_000;
  const phone = `62811${String(stamp).padStart(6, "0")}`;

  await page.goto("/settings/connectors");
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId("catalog-wa-fonnte")
    .getByRole("button", { name: /Hubungkan|Kelola/ })
    .click();
  await page.getByLabel("Token / API key").fill(`token-e2e-${stamp}-abcdef`);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  const secret = (await page.getByTestId("wa-secret").textContent())!.trim();
  expect(secret).toMatch(/^wasec_/);
  const publicId = (await page.getByRole("dialog").locator("code").first().textContent())!
    .split("/")
    .pop()!;
  await page.getByRole("button", { name: "Selesai" }).click();

  const bad = await request.post(`/api/webhooks/whatsapp/${publicId}?token=salah`, {
    data: { sender: phone, message: "tidak boleh" },
  });
  expect(bad.status()).toBe(401);
  const ok = await request.post(`/api/webhooks/whatsapp/${publicId}?token=${secret}`, {
    data: {
      sender: phone,
      message: `Halo dari E2E ${stamp}`,
      name: `Pelanggan ${stamp}`,
      id: `e2e-${stamp}`,
    },
  });
  expect(ok.status()).toBe(200);

  await page.goto("/inbox");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: new RegExp(`Pelanggan ${stamp}`) }).click();
  await expect(page.getByTestId("thread")).toContainText(`Halo dari E2E ${stamp}`);
  await page.locator("#assignee").click();
  await page.getByRole("option").nth(1).click();
  await expect(page.getByText("Penugasan diubah")).toBeVisible();
});
