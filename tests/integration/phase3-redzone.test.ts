import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { snapshotDb } from "../helpers/snapshot";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { scoreLeads, getLeadScore } = await import("@/modules/intelligence/server/lead-scoring");
const { getDealPrediction, getPipelineBacktest } =
  await import("@/modules/intelligence/server/deal-prediction");
const { getForecast } = await import("@/modules/intelligence/server/forecast");
const { getFollowUpRecommendation, getAcceptanceMetrics } =
  await import("@/modules/intelligence/server/followup");
const { listInsightAlerts } = await import("@/modules/intelligence/server/insights");
const { getDataQuality } = await import("@/modules/intelligence/server/quality");
const { getUnifiedTimeline } = await import("@/modules/omnichannel/server/timeline");
const { ensureDefaultPipeline } = await import("@/modules/deals/server/pipeline");

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Phase 3 — Red Zone (semua fitur cerdas non-autonomous)", () => {
  it("pemindaian sumber: modul prediktif/rekomendasi hanya MEMBACA; aksi tulis hanya di berkas aksi eksplisit pengguna", () => {
    const readOnly = [
      ...globSync("src/modules/intelligence/*.ts"),
      "src/modules/intelligence/server/lead-scoring.ts",
      "src/modules/intelligence/server/deal-prediction.ts",
      "src/modules/intelligence/server/forecast.ts",
      "src/modules/intelligence/server/followup.ts",
      "src/modules/intelligence/server/followup-view.ts",
      "src/modules/intelligence/server/insights.ts",
      "src/modules/intelligence/server/quality.ts",
      "src/modules/omnichannel/server/timeline.ts",
      "src/modules/omnichannel/server/queries.ts",
      "src/modules/omnichannel/routing.ts",
      "src/modules/omnichannel/timeline.ts",
    ];
    expect(readOnly.length).toBeGreaterThanOrEqual(18);
    const forbidden =
      /\.(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(|\bsendMail\b|\bfetch\s*\(|\$executeRaw|\$queryRawUnsafe|\$transaction/;
    for (const f of readOnly)
      expect(
        forbidden.test(strip(readFileSync(f, "utf8"))),
        `${f} memuat operasi tulis/kirim`,
      ).toBe(false);

    // Tidak ada penggunaan AI/LLM yang menulis: modul intelligence tidak mengimpor penyedia model.
    for (const f of globSync("src/modules/intelligence/**/*.{ts,tsx}"))
      expect(/from "ai"|@ai-sdk\//.test(readFileSync(f, "utf8")), `${f} memakai LLM`).toBe(false);

    // Aksi eksplisit pengguna: hanya menulis entitas yang dimaksud (task/umpan balik/alert/audit).
    const accept = strip(
      readFileSync("src/modules/intelligence/server/followup-actions.ts", "utf8"),
    );
    expect(accept).not.toMatch(
      /sendMail|fetch\s*\(|\.(lead|deal|contact|company|quotation|message)\.(create|update|delete)/,
    );
    const insightActions = strip(
      readFileSync("src/modules/intelligence/server/insight-actions.ts", "utf8"),
    );
    expect(insightActions).not.toMatch(
      /\.(lead|deal|contact|company|quotation|activity|message)\.(create|update|delete)/,
    );

    // Pemindai terjadwal: hanya menulis insight_alerts & notifications.
    const scan = strip(readFileSync("src/lib/insight-scan.ts", "utf8"));
    const writes = [
      ...scan.matchAll(
        /\b(?:db|prisma)\.(\w+)\.(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(/g,
      ),
    ].map((m) => m[1]);
    expect(new Set(writes)).toEqual(new Set(["insightAlert", "notification"]));
  });

  it("menjalankan SEMUA fungsi baca Phase 3 pada organisasi berisi data tidak mengubah satu pun tabel", async () => {
    const o = await makeOrg("Org A");
    const ctx0 = await getTenantContext();
    const pipeline = await ensureDefaultPipeline(ctx0!.db);
    const [s1, s2] = pipeline.stages;
    const company = await testPrisma.company.create({
      data: { organizationId: o.orgId, name: "PT Z" },
    });
    const contact = await testPrisma.contact.create({
      data: {
        organizationId: o.orgId,
        name: "Budi",
        email: "b@z.test",
        phone: "0812",
        phoneNormalized: "62812",
      },
    });
    const lead = await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "Lead Z", email: "l@z.test", urgency: "high" },
    });
    for (let i = 0; i < 14; i++) {
      const d = await testPrisma.deal.create({
        data: {
          organizationId: o.orgId,
          title: `H${i}`,
          pipelineId: pipeline.id,
          stageId: s2!.id,
          status: i < 8 ? "won" : "lost",
          value: 1_000_000,
          companyId: company.id,
          closedAt: new Date(Date.now() - (20 + (i % 4) * 30) * 86_400_000),
        },
      });
      await testPrisma.dealStageHistory.create({
        data: { organizationId: o.orgId, dealId: d.id, fromStageId: s1!.id, toStageId: s2!.id },
      });
    }
    const open = await testPrisma.deal.create({
      data: {
        organizationId: o.orgId,
        title: "Terbuka",
        pipelineId: pipeline.id,
        stageId: s2!.id,
        value: 5_000_000,
        contactId: contact.id,
        expectedCloseDate: new Date(Date.now() + 10 * 86_400_000),
      },
    });
    for (let i = 0; i < 4; i++)
      await testPrisma.activity.create({
        data: {
          organizationId: o.orgId,
          type: "call",
          subject: `C${i}`,
          status: "done",
          leadId: lead.id,
          contactId: contact.id,
          completedAt: new Date(Date.now() - i * 7 * 86_400_000),
        },
      });
    await testPrisma.insightAlert.create({
      data: {
        organizationId: o.orgId,
        kind: "win_rate_drop",
        severity: "medium",
        title: "t",
        detail: "d",
        dedupeKey: "k",
      },
    });

    const before = await snapshotDb([]);
    const ctx = (await getTenantContext())!;
    const rows = await ctx.db.lead.findMany();
    await scoreLeads(ctx, rows);
    await getLeadScore(ctx, lead.id);
    const pred = await getDealPrediction(ctx, open.id);
    expect(pred).toMatchObject({ ready: true });
    await getPipelineBacktest(ctx, pipeline.id);
    const fc = await getForecast(ctx);
    expect(fc.ready).toBe(true);
    for (const subject of [
      { type: "lead", id: lead.id },
      { type: "contact", id: contact.id },
      { type: "company", id: company.id },
    ] as const) {
      await getFollowUpRecommendation(ctx, subject);
      await getUnifiedTimeline(ctx, subject);
    }
    await getAcceptanceMetrics(ctx);
    await listInsightAlerts(ctx);
    await getDataQuality(ctx);
    expect(await snapshotDb([])).toEqual(before);
  });
});
