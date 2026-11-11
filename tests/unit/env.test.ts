import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
  DATABASE_URL: "postgresql://u:p@localhost:5434/crm_test",
  REDIS_URL: "redis://localhost:6380",
  S3_ENDPOINT: "http://localhost:9100",
  S3_BUCKET: "crm-files",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "secret-12345",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...VALID, ...env })) {
    if (v === undefined) vi.stubEnv(k, "");
    else vi.stubEnv(k, v);
  }
  return import("@/lib/env");
}

describe("env", () => {
  it("memuat env yang valid", async () => {
    const { env } = await load({});
    expect(env.S3_BUCKET).toBe("crm-files");
    expect(env.S3_REGION).toBe("us-east-1");
  });

  it("gagal cepat dengan pesan jelas bila env wajib kosong", async () => {
    await expect(load({ REDIS_URL: undefined })).rejects.toThrow(/REDIS_URL/);
  });

  it("menolak DATABASE_URL yang bukan URL", async () => {
    await expect(load({ DATABASE_URL: "bukan-url" })).rejects.toThrow(/DATABASE_URL/);
  });
});
