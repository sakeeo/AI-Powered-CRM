// Load test sederhana (autocannon) terhadap build production yang sedang berjalan.
// Pemakaian: BASE_URL=http://localhost:3300 node scripts/load-test.mjs
// Memakai cookie session E2E (e2e/.auth/user.json — dibuat `npm run test:e2e`; tidak pernah di-commit).
import autocannon from "autocannon";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3300";
const DURATION = Number(process.env.DURATION ?? 8);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 4);
const TARGET_P95_MS = 500;

const state = JSON.parse(readFileSync("e2e/.auth/user.json", "utf8"));
const cookie = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const paths = [
  "/api/health",
  "/dashboard",
  "/leads",
  "/contacts",
  "/deals",
  "/deals?view=board",
  "/customers",
  "/quotations",
  "/products",
  "/reports",
  "/activities",
];
const rows = [];
for (const path of paths) {
  const r = await autocannon({
    url: BASE + path,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { cookie },
  });
  const non2xx = r.non2xx + r.errors + r.timeouts;
  // autocannon melaporkan p90 dan p97.5; P95 berada di antaranya → pakai p97.5 (konservatif).
  rows.push({
    path,
    rps: Math.round(r.requests.average),
    p50: r.latency.p50,
    p90: r.latency.p90,
    p97_5: r.latency.p97_5,
    p99: r.latency.p99,
    errors: non2xx,
  });
}
console.table(rows);
const bad = rows.filter((r) => r.p97_5 >= TARGET_P95_MS || r.errors > 0);
if (bad.length) {
  console.error(
    `GAGAL: ${bad.map((b) => b.path).join(", ")} melewati target P95 < ${TARGET_P95_MS} ms atau error`,
  );
  process.exit(1);
}
console.log(
  `OK: semua endpoint P95 < ${TARGET_P95_MS} ms tanpa error (${CONNECTIONS} koneksi, ${DURATION}s)`,
);
