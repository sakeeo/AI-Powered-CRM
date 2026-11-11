import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDb, testPrisma } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => testPrisma.$disconnect());

it("migrasi terpasang dan Organization memakai UUID + timestamp otomatis", async () => {
  const org = await testPrisma.organization.create({ data: { name: "Acme", slug: "acme" } });
  expect(org.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(org.createdAt).toBeInstanceOf(Date);
  expect(org.deletedAt).toBeNull();
});

it("resetDb mengosongkan tabel", async () => {
  await testPrisma.organization.create({ data: { name: "A", slug: "a" } });
  await resetDb();
  expect(await testPrisma.organization.count()).toBe(0);
});
