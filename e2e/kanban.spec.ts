import { expect, test } from "@playwright/test";

test("kanban: kartu di papan, drag keyboard memindah stage, Lost wajib alasan", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  const contact = `Kontak Board ${stamp}`;
  const deal = `Deal Board ${stamp}`;

  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah contact" }).first().click();
  await page.getByLabel("Nama", { exact: true }).fill(contact);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

  await page.goto("/deals");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah deal" }).first().click();
  await page.getByLabel("Judul deal").fill(deal);
  await page.getByLabel("Contact").click();
  await page.getByRole("option", { name: contact }).click();
  await page.getByLabel("Nilai deal").fill("1000000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);
  const detail = page.url();

  // Papan: kartu ada di kolom stage pertama; geser dengan keyboard ke kolom berikutnya.
  await page.goto("/deals?view=board");
  const first = page.getByTestId("col-New Opportunity");
  await expect(first.getByText(deal)).toBeVisible();
  const card = first.locator("[data-rfd-draggable-id]", { hasText: deal });
  await card.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("col-Contacted").getByText(deal)).toBeVisible();

  // Riwayat stage tercatat di detail; Lost butuh alasan.
  await page.goto(detail);
  await expect(page.getByTestId("stage-history")).toContainText("Contacted");
  await page.getByRole("button", { name: "Lost", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Alasan kalah wajib diisi/)).toBeVisible();
  await page.getByLabel("Alasan").fill("Harga terlalu tinggi");
  await page.getByRole("dialog").getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Harga terlalu tinggi")).toBeVisible();
});
