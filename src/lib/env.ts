import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL harus berupa URL PostgreSQL yang valid"),
  REDIS_URL: z.string().url("REDIS_URL harus berupa URL Redis yang valid"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  // Hanya untuk build Docker/CI tanpa env runtime. Jangan dipakai saat menjalankan aplikasi.
  if (process.env.SKIP_ENV_VALIDATION === "1") return process.env as unknown as Env;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}\nLihat .env.example.`);
  }
  return parsed.data;
}

export const env = load();
