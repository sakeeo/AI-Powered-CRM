import "dotenv/config";

// Semua test memakai database terpisah `crm_test` (siapkan dengan `npm run db:test:setup`).
const url = new URL(process.env.DATABASE_URL ?? "postgresql://x:x@localhost:5434/crm_dev");
url.pathname = "/crm_test";
process.env.DATABASE_URL = url.toString();
