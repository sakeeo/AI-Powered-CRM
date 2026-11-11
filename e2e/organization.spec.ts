import { expect, test } from "@playwright/test";

test("profil organisasi dapat diubah di Settings", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const name = `E2E Org ${Date.now() % 1000}`;
  await page.getByLabel("Nama organisasi").fill(name);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Profil organisasi disimpan")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nama organisasi")).toHaveValue(name);
});

test("Owner mengundang anggota dan membuat tim", async ({ page }) => {
  await page.goto("/users");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("E2E User (Anda)")).toBeVisible();

  await page.getByRole("button", { name: "Undang anggota" }).click();
  const email = `invite-${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Kirim undangan" }).click();
  await expect(page.locator("li", { hasText: new RegExp(`^${email}`) })).toBeVisible();

  const team = `Tim ${Date.now() % 10000}`;
  await page.getByLabel("Nama tim baru").fill(team);
  await page.getByRole("button", { name: "Buat tim" }).click();
  await expect(page.getByText(team)).toBeVisible();
});

test("switcher organisasi menampilkan organisasi aktif", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ganti organisasi" }).click();
  await expect(page.getByRole("menuitem", { name: /Buat organisasi baru/ })).toBeVisible();
});
