import { expect, test } from "@playwright/test";

test("halaman utama mengarah ke dashboard dan menampilkan shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leads" })).toBeVisible();
});

test("navigasi sidebar ke halaman lain", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
});

test("command palette terbuka dengan Ctrl+K dan berpindah halaman", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/mencari halaman/i).fill("deal");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/deals$/);
});

test("theme toggle mengganti tema gelap/terang", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Ganti tema" }).click();
  await page.getByRole("menuitem", { name: "Gelap" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Ganti tema" }).click();
  await page.getByRole("menuitem", { name: "Terang" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("health endpoint memeriksa dependency", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  expect(body.checks).toHaveProperty("database");
  expect(body.checks).toHaveProperty("redis");
  expect(body.checks).toHaveProperty("storage");
});
