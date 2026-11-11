// Menyiapkan database test `crm_test` (buat bila belum ada) lalu menerapkan migrasi.
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

const base = new URL(process.env.DATABASE_URL);
const testName = "crm_test";
const admin = new URL(base);
admin.pathname = "/postgres";
admin.search = "";

const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [testName]);
if (!rowCount) {
  await client.query(`CREATE DATABASE ${testName}`);
  console.log(`Database ${testName} dibuat.`);
}
await client.end();

const testUrl = new URL(base);
testUrl.pathname = `/${testName}`;
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl.toString() },
});
