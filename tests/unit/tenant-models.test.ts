import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { TENANT_MODELS } from "@/lib/tenant";

it("TENANT_MODELS sinkron dengan model ber-organizationId di schema.prisma", () => {
  const schema = readFileSync(path.resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
  const found = new Set<string>();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    if (/^\s*organizationId\s/m.test(m[2])) found.add(m[1]);
  }
  expect([...found].sort()).toEqual([...TENANT_MODELS].sort());
});
