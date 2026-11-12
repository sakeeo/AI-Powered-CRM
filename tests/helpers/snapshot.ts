import { testPrisma } from "./db";

/** Salinan isi seluruh tabel (kecuali yang dikecualikan) — membuktikan sebuah operasi tidak mengubah data. */
export async function snapshotDb(exclude: string[] = ["ai_call_logs"]) {
  const skip = ["_prisma_migrations", ...exclude];
  const tables = await testPrisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  const out: Record<string, string> = {};
  for (const t of tables) {
    if (skip.includes(t.tablename)) continue;
    const rows = await testPrisma.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM "public"."${t.tablename}" ORDER BY 1`,
    );
    out[t.tablename] = JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  }
  return out;
}
