import { mkdirSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";

/** Membuat satu pengguna + organisasi e2e dan menyimpan session-nya sebagai storageState. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync("e2e/.auth", { recursive: true });
  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      "x-forwarded-for": `10.99.${Date.now() % 250}.${process.pid % 250}`,
    },
  });
  const res = await ctx.post("/api/auth/sign-up/email", {
    data: {
      name: "E2E User",
      email: `e2e-${Date.now()}@example.com`,
      password: "e2e-password-123",
    },
  });
  if (!res.ok()) throw new Error(`Gagal membuat pengguna e2e: ${res.status()} ${await res.text()}`);
  const org = await ctx.post("/api/auth/organization/create", {
    data: { name: "E2E Org", slug: `e2e-${Date.now()}` },
  });
  if (!org.ok())
    throw new Error(`Gagal membuat organisasi e2e: ${org.status()} ${await org.text()}`);
  await ctx.storageState({ path: "e2e/.auth/user.json" });
  await ctx.dispose();
}
