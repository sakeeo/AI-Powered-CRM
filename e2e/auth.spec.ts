import { expect, test } from "@playwright/test";

// Spec ini menguji alur sebagai pengunjung/pengguna baru, bukan memakai session global.
test.use({
  storageState: { cookies: [], origins: [] },
  // Rate limit auth bersifat per-IP; beri IP unik per run agar run berulang tidak saling memblokir.
  extraHTTPHeaders: { "x-forwarded-for": `10.8.${Date.now() % 250}.${process.pid % 250}` },
});

const password = "rahasia-12345";

test("route privat dialihkan ke /login tanpa session", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads$/);
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
});

test("register → logout → login → akses privat", async ({ page }) => {
  const email = `flow-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Nama lengkap").fill("Budi Santoso");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Konfirmasi password").fill(password);
  await page.getByRole("button", { name: "Daftar" }).click();
  // Pengguna baru belum punya organisasi → onboarding.
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nama organisasi").fill("Flow Org");
  await page.getByRole("button", { name: "Buat organisasi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Menu pengguna" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/login\?next=%2Fdeals$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/deals$/); // kembali ke tujuan semula
});

test("login dengan password salah menampilkan error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("tidak-ada@example.com");
  await page.getByLabel("Password").fill("salah-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Email atau password salah.")).toBeVisible();
});

test("validasi form sign up", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByText("Email tidak valid")).toBeVisible();
});

test("halaman lupa password mengonfirmasi tanpa membocorkan akun", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("siapa-saja@example.com");
  await page.getByRole("button", { name: "Kirim tautan reset" }).click();
  await expect(page.getByRole("status")).toContainText("Jika email terdaftar");
});

test("reset-password tanpa token menampilkan pesan tidak valid", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText(/tautan reset tidak valid/i)).toBeVisible();
});
