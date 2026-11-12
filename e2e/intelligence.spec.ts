import { expect, test } from "@playwright/test";

test("lead: skor, rekomendasi follow-up (draf → task atas persetujuan), dan timeline terpadu", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  const name = `Lead Cerdas ${stamp}`;
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(name);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

  // Skor: transparan (faktor tampil), hanya informasi
  await expect(page.getByTestId("lead-score-card")).toBeVisible();
  await expect(page.getByTestId("lead-score-card")).toContainText("Kelengkapan kontak");
  await expect(page.getByTestId("lead-score-card")).toContainText("tidak mengubah status");

  // Timeline terpadu hadir; rekomendasi follow-up berupa draf
  await expect(page.getByTestId("unified-timeline")).toBeVisible();
  const card = page.getByTestId("followup-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText(`Follow-up: ${name}`);
  await expect(card).toContainText("Tidak ada pesan yang dikirim otomatis");
  await card.getByRole("button", { name: "Buat task follow-up" }).click();
  await expect(page.getByTestId("timeline")).toContainText(`Follow-up: ${name}`);
});

test("lead baru muncul dengan badge skor di daftar lead", async ({ page }) => {
  const name = `Lead Badge ${Date.now() % 100000}`;
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(name);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  await page.goto(`/leads?q=${encodeURIComponent(name)}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("columnheader", { name: "Skor" })).toBeVisible();
  await expect(
    page.getByRole("row", { name: new RegExp(name) }).getByTestId("lead-score-badge"),
  ).toBeVisible();
});

test("halaman Intelligence: kesiapan data, anomali, akurasi, dan penerimaan rekomendasi", async ({
  page,
}) => {
  await page.goto("/intelligence");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("readiness-card")).toContainText("Kualitas data & kesiapan fitur");
  await expect(page.getByTestId("insight-alerts")).toContainText("tidak ada tindakan otomatis");
  await expect(page.getByTestId("accuracy-card")).toBeVisible();
  await expect(page.getByTestId("acceptance-card")).toBeVisible();
  // Pindai manual (Owner) berjalan dan tidak menghasilkan galat
  await page.getByRole("button", { name: "Pindai sekarang" }).click();
  await expect(page.getByText(/anomali baru/)).toBeVisible();
});

test("Forecast: label estimasi selalu tampak; data kurang → alasan, bukan angka", async ({
  page,
}) => {
  await page.goto("/forecast");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("forecast-disclaimer")).toContainText("bukan jaminan");
  await expect(
    page.getByTestId("forecast-not-ready").or(page.getByTestId("forecast-table")),
  ).toBeVisible();
});

test("Routing Inbox: aturan round robin tersimpan; filter kanal tersedia di Inbox", async ({
  page,
}) => {
  await page.goto("/settings/routing");
  await page.waitForLoadState("networkidle");
  const row = page.getByTestId("routing-email");
  await expect(row).toBeVisible();
  await row.locator("#strategy-email").click();
  await page.getByRole("option", { name: "Bergilir (round robin)" }).click();
  await row.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Aturan routing disimpan")).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("routing-email").locator("#strategy-email")).toContainText(
    "Bergilir",
  );

  await page.goto("/inbox");
  await page.waitForLoadState("networkidle");
  const filter = page.getByTestId("kind-filter");
  await expect(filter).toContainText("Email");
  await expect(filter).toContainText("WhatsApp");
  await filter.getByRole("link", { name: "Email" }).click();
  await expect(page).toHaveURL(/kind=email/);
});
