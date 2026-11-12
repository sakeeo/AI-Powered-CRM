import { expect, test } from "@playwright/test";

test("kustomisasi: tag & custom field di form, tabel, filter, lalu simpan tampilan", async ({
  page,
}) => {
  const stamp = Date.now() % 100000;
  const tag = `VIP${stamp}`;
  const field = `Segmen${stamp}`;
  const lead = `Lead Kustom ${stamp}`;

  // Tag
  await page.goto("/settings/tags");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nama tag baru").fill(tag);
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(page.getByText(tag, { exact: true })).toBeVisible();

  // Custom field (select, tampil di tabel + filter)
  await page.goto("/settings/custom-fields");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah field" }).click();
  await page.getByLabel("Label", { exact: true }).fill(field);
  await page.locator("#cf-type").click();
  await page.getByRole("option", { name: "Pilihan tunggal" }).click();
  await page.getByLabel("Opsi (satu per baris)").fill("UKM\nKorporasi");
  await page.getByLabel("Tampil di tabel").click();
  await page.getByLabel("Dapat difilter").click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText(field, { exact: true })).toBeVisible();

  // Lead dengan tag + custom field
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tambah lead" }).first().click();
  await page.getByLabel("Nama lead").fill(lead);
  await page.locator("#tag-add").click();
  await page.getByRole("option", { name: tag }).click();
  await page.locator(`#cf-lead-${field.toLowerCase()}`).click();
  await page.getByRole("option", { name: "Korporasi" }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  await expect(page.getByText("Tag & data tambahan")).toBeVisible();
  await expect(page.getByText("Korporasi")).toBeVisible();

  // Tabel: kolom custom field + tag, lalu filter
  await page.goto("/leads");
  await page.waitForLoadState("networkidle");
  const row = page.getByRole("row", { name: new RegExp(lead) });
  await expect(row).toContainText("Korporasi");
  await expect(row).toContainText(tag);
  await page.getByRole("combobox", { name: `Filter ${field}` }).click();
  await page.getByRole("option", { name: "UKM" }).click();
  await expect(page.getByRole("row", { name: new RegExp(lead) })).toHaveCount(0);
  await page.getByRole("combobox", { name: `Filter ${field}` }).click();
  await page.getByRole("option", { name: "Korporasi" }).click();
  await expect(page.getByRole("row", { name: new RegExp(lead) })).toBeVisible();

  // Saved view
  await page.getByRole("button", { name: "Simpan tampilan" }).click();
  await page.getByLabel("Nama tampilan").fill(`Korp ${stamp}`);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tampilan disimpan")).toBeVisible();
  await page.goto("/leads?all=1");
  await page.waitForLoadState("networkidle");
  await page.locator("#views-lead").click();
  await page.getByRole("option", { name: `Korp ${stamp}` }).click();
  await expect(page).toHaveURL(new RegExp(`cf_${field.toLowerCase()}=korporasi`));
});
