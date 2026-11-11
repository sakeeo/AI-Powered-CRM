import { expect, test } from "@playwright/test";

test("notifikasi: bell, inbox, dan preferensi; kartu email delivery tersedia", async ({ page }) => {
  await page.goto("/notifications");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /Notifikasi, \d+ belum dibaca/ })).toBeVisible();
  await expect(page.getByText("Inbox", { exact: true })).toBeVisible();
  const email = page.getByLabel("Kirim reminder ke email");
  await expect(email).toBeChecked();
  await email.click();
  await expect(page.getByText("Preferensi disimpan")).toBeVisible();
  await email.click();
  await expect(page.getByText("Preferensi disimpan").first()).toBeVisible();

  await page.getByRole("button", { name: /Notifikasi, \d+ belum dibaca/ }).click();
  await expect(page.getByRole("menuitem", { name: "Lihat semua" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/settings/connectors");
  await expect(page.getByRole("heading", { name: "Email delivery", level: 4 })).toBeVisible();
  await page
    .getByRole("button", { name: /Konfigurasi|Ubah/ })
    .last()
    .click();
  await page.getByLabel("Alamat pengirim").fill("x");
  await page.getByLabel("Host").fill("smtp.example.com");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
