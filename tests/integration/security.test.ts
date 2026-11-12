import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const generateText = vi.hoisted(() => vi.fn());
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));

const { redis } = await import("@/lib/redis");
const { logger } = await import("@/lib/logger");
const { getTenantContext } = await import("@/lib/context");
const { parseListParams } = await import("@/lib/list-params");
const leadA = await import("@/modules/leads/server/actions");
const leadQ = await import("@/modules/leads/server/queries");
const contactA = await import("@/modules/contacts/server/actions");
const contactQ = await import("@/modules/contacts/server/queries");
const companyA = await import("@/modules/companies/server/actions");
const companyQ = await import("@/modules/companies/server/queries");
const dealA = await import("@/modules/deals/server/actions");
const dealQ = await import("@/modules/deals/server/queries");
const actA = await import("@/modules/activities/server/actions");
const actQ = await import("@/modules/activities/server/queries");
const quoA = await import("@/modules/quotations/server/actions");
const quoQ = await import("@/modules/quotations/server/queries");
const prodA = await import("@/modules/products/server/actions");
const fbA = await import("@/modules/feedback/server/actions");
const custA = await import("@/modules/customers/server/actions");
const custQ = await import("@/modules/customers/server/queries");
const connA = await import("@/modules/connectors/server/actions");
const connQ = await import("@/modules/connectors/server/queries");
const emailA = await import("@/modules/connectors/server/email-actions");
const hookA = await import("@/modules/webhooks/server/actions");
const hookQ = await import("@/modules/webhooks/server/queries");
const impA = await import("@/modules/import-export/server/actions");
const aiLead = await import("@/modules/leads/server/ai-actions");
const aiAct = await import("@/modules/activities/server/ai-actions");
const aiCust = await import("@/modules/customers/server/ai-actions");
const aiRep = await import("@/modules/reports/server/ai-actions");
const { listAuditLogs } = await import("@/modules/audit/server/queries");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const ctxNow = async () => (await getTenantContext())!;
const p = (sort = "createdAt") => parseListParams({}, [sort], sort);

beforeEach(async () => {
  await resetDb();
  generateText.mockReset();
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("Isolasi tenant — seluruh entitas (IDOR lintas organisasi)", () => {
  it("Org B tidak dapat membaca/mengubah/menghapus entitas apa pun milik Org A", async () => {
    const a = await makeOrg("Org A");
    const contactId = idOf(await contactA.createContact({ name: "Kontak Rahasia" }));
    const companyId = idOf(await companyA.createCompany({ name: "PT Rahasia" }));
    const leadId = idOf(await leadA.createLead({ name: "Lead Rahasia" }));
    const dealId = idOf(
      await dealA.createDeal({ title: "Deal Rahasia", contactId, value: "1000" }),
    );
    const activityId = idOf(
      await actA.createActivity({
        type: "task",
        subject: "Tugas Rahasia",
        leadId,
        dueLocal: "2099-01-01",
      }),
    );
    const productId = idOf(await prodA.createProduct({ name: "Produk Rahasia", price: "100" }));
    const quotationId = idOf(await quoA.createQuotation({ title: "Quo Rahasia", dealId }));
    const feedbackId = idOf(
      await fbA.createFeedback({ type: "complaint", subject: "Komplain Rahasia", contactId }),
    );
    await dealA.markDealWon({ id: dealId });

    await makeOrg("Org B");
    const ctx = await ctxNow();
    const gone = { status: 404 };
    // Pembacaan
    await expect(leadQ.getLead(ctx, leadId)).rejects.toMatchObject(gone);
    await expect(contactQ.getContact(ctx, contactId)).rejects.toMatchObject(gone);
    await expect(companyQ.getCompany(ctx, companyId)).rejects.toMatchObject(gone);
    await expect(dealQ.getDeal(ctx, dealId)).rejects.toMatchObject(gone);
    await expect(quoQ.getQuotation(ctx, quotationId)).rejects.toMatchObject(gone);
    await expect(custQ.getCustomer360(ctx, "contact", contactId)).rejects.toMatchObject(gone);
    expect(await actQ.listTimeline(ctx, { leadId })).toEqual([]);
    for (const total of [
      (await leadQ.listLeads(ctx, p("createdAt"))).total,
      (await contactQ.listContacts(ctx, p("createdAt"))).total,
      (await companyQ.listCompanies(ctx, p("createdAt"))).total,
      (await dealQ.listDeals(ctx, p("createdAt"))).total,
      (await quoQ.listQuotations(ctx, p("createdAt"))).total,
      (await custQ.listCustomers(ctx, p("lastWonAt"))).total,
    ])
      expect(total).toBe(0);

    // Penulisan: semua ditolak
    const denied = [
      await leadA.updateLead({ id: leadId, name: "Diretas" }),
      await leadA.archiveLead({ id: leadId }),
      await leadA.setLeadStatus({ id: leadId, status: "qualified" }),
      await contactA.updateContact({ id: contactId, name: "Diretas", companyIds: [] } as never),
      await contactA.deleteContact({ id: contactId }),
      await companyA.deleteCompany({ id: companyId }),
      await dealA.markDealWon({ id: dealId }),
      await dealA.markDealLost({ id: dealId, reason: "diretas" }),
      await dealA.reopenDeal({ id: dealId }),
      await dealA.deleteDeal({ id: dealId }),
      await actA.setActivityStatus({ id: activityId, status: "done" }),
      await actA.deleteActivity({ id: activityId }),
      await prodA.deleteProduct({ id: productId }),
      await prodA.setProductActive({ id: productId, isActive: false }),
      await quoA.setQuotationStatus({ id: quotationId, status: "sent" }),
      await quoA.deleteQuotation({ id: quotationId }),
      await fbA.deleteFeedback({ id: feedbackId }),
      await fbA.setFeedbackStatus({ id: feedbackId, status: "resolved" }),
      await custA.assignSegment({ type: "contact", id: contactId, name: "VIP" }),
      // referensi silang: membuat record B yang menunjuk record A
      await actA.createActivity({ type: "note", subject: "Silang", leadId }),
      await dealA.createDeal({ title: "Deal silang", contactId }),
      await fbA.createFeedback({ type: "feedback", subject: "Silang", contactId }),
      await quoA.createQuotation({ dealId }),
      await prodA.addDealProduct({ dealId, productId, quantity: 1 }),
      await aiAct.aiGhostwriteFollowUp({ leadId }),
      await aiCust.aiCustomerBriefing({ type: "contact", id: contactId }),
    ];
    denied.forEach((r, i) => expect(r, `aksi #${i} harus ditolak`).toMatchObject({ ok: false }));

    // Data Org A utuh
    expect(
      await testPrisma.lead.count({
        where: { organizationId: a.orgId, name: "Lead Rahasia", archivedAt: null },
      }),
    ).toBe(1);
    expect((await testPrisma.deal.findUniqueOrThrow({ where: { id: dealId } })).status).toBe("won");
    expect(await testPrisma.activity.count({ where: { organizationId: a.orgId } })).toBe(1);
    expect(await testPrisma.feedback.count({ where: { organizationId: a.orgId } })).toBe(1);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("log audit, connector, dan webhook tidak terlihat lintas organisasi; peran rendah tidak bisa mengelola", async () => {
    const a = await makeOrg("Org A");
    await connA.saveAiConnector({
      provider: "openai",
      apiKey: "sk-test-1234567890",
      model: "gpt-4.1-mini",
    });
    await hookA.generateWebhook({});
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(await hookA.generateWebhook({})).toMatchObject({ ok: false });
    expect(await connA.removeAiConnector({ provider: "openai" })).toMatchObject({ ok: false });
    expect(
      await impA.importLeadsBatch({ rows: [{ name: "Impor Rep" }], startRow: 2 }),
    ).toMatchObject({ ok: true });
    await expect(
      listAuditLogs(await ctxNow(), { page: 1, pageSize: 10 } as never),
    ).rejects.toMatchObject({ status: 403 });
    await makeOrg("Org B");
    const ctx = await ctxNow();
    expect(await connQ.listConnectors(ctx)).toEqual([]);
    expect(await hookQ.getWebhookView(ctx)).toBeNull();
    expect(
      (await listAuditLogs(ctx, { page: 1, pageSize: 50 } as never)).rows.every(
        (r: { action: string }) =>
          !r.action.startsWith("webhook") && !r.action.startsWith("connector"),
      ),
    ).toBe(true);
    expect(await testPrisma.lead.count({ where: { name: "Impor Rep" } })).toBe(1);
    expect(await leadQ.listLeads(ctx, p("createdAt")).then((r) => r.total)).toBe(0);
  });
});

describe("AI Red Zone — AI hanya membuat draf", () => {
  it("tidak ada fungsi AI yang memutasi data bisnis, mengirim pesan, atau menghitung uang (pemindaian sumber)", () => {
    const files = [
      ...globSync("src/modules/*/server/*ai-actions.ts"),
      "src/modules/activities/server/ai.ts",
      "src/modules/customers/server/ai.ts",
      "src/modules/leads/server/text-to-lead.ts",
      "src/modules/reports/server/lost-category.ts",
      "src/modules/quotations/server/narrative.ts",
      "src/modules/insights/server/plan-ai.ts",
      "src/modules/insights/server/execute.ts",
    ];
    expect(files.length).toBeGreaterThanOrEqual(8);
    const forbidden =
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\bsendMail\b|\bfetch\s*\(|\$executeRaw|\$queryRawUnsafe|Decimal\s*\(/;
    for (const f of files) {
      const src = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      // pengecualian: kalimat petunjuk di dalam string prompt tidak mengandung pemanggilan di atas
      expect(forbidden.test(src), `${f} memuat operasi terlarang`).toBe(false);
    }
  });

  it("menjalankan SETIAP fitur AI tidak mengubah satu pun tabel bisnis (hanya ai_call_logs)", async () => {
    await makeOrg("Org A");
    await connA.saveAiConnector({
      provider: "openai",
      apiKey: "sk-test-1234567890",
      model: "gpt-4.1-mini",
    });
    const contactId = idOf(await contactA.createContact({ name: "Kontak AI" }));
    const leadId = idOf(await leadA.createLead({ name: "Lead AI" }));
    const dealId = idOf(await dealA.createDeal({ title: "Deal AI", contactId, value: "100" }));
    await dealA.markDealWon({ id: dealId });
    await fbA.createFeedback({ type: "complaint", subject: "Komplain AI", contactId });
    await actA.createActivity({ type: "note", subject: "Catatan AI", leadId });
    const lost = idOf(await dealA.createDeal({ title: "Deal Lost AI", contactId }));
    await dealA.markDealLost({ id: lost, reason: "Mahal" });

    const snapshot = async () => {
      const tables = await testPrisma.$queryRaw<
        { tablename: string }[]
      >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','ai_call_logs')`;
      const out: Record<string, string> = {};
      for (const t of tables) {
        const rows = await testPrisma.$queryRawUnsafe<unknown[]>(
          `SELECT * FROM "public"."${t.tablename}" ORDER BY 1`,
        );
        out[t.tablename] = JSON.stringify(rows, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
      }
      return out;
    };
    const before = await snapshot();
    generateText
      .mockResolvedValueOnce({
        output: {
          name: "Budi",
          email: null,
          phone: null,
          companyName: null,
          needs: "x",
          budget: null,
          currency: null,
          urgency: null,
          notes: null,
        },
      })
      .mockResolvedValueOnce({ output: { summary: "Ringkasan." } })
      .mockResolvedValueOnce({
        output: { items: [{ subject: "Follow up", type: "task", dueDate: "2026-12-01" }] },
      })
      .mockResolvedValueOnce({
        output: { options: [{ channel: "whatsapp", subject: null, text: "Halo" }] },
      })
      .mockResolvedValueOnce({ output: { issue: "Ada komplain.", opportunity: "Renewal." } })
      .mockResolvedValueOnce({ output: { category: "Harga" } });
    const results = [
      await aiLead.draftLeadFromText({ text: "Halo saya Budi butuh sistem kasir" }),
      await aiAct.aiSummarizeNotes({ text: "Coretan meeting panjang untuk diringkas" }),
      await aiAct.aiExtractActionItems({ text: "Setuju demo tanggal 1 Desember" }),
      await aiAct.aiGhostwriteFollowUp({ leadId }),
      await aiCust.aiCustomerBriefing({ type: "contact", id: contactId }),
      await aiRep.aiSuggestLostCategory({ text: "Mahal" }),
    ];
    results.forEach((r, i) => expect(r.ok, `fitur AI #${i}`).toBe(true));
    expect(await snapshot()).toEqual(before);
    expect(await testPrisma.aiCallLog.count({ where: { status: "ok" } })).toBe(6);
    expect(await testPrisma.notification.count()).toBe(0);
  });
});

describe("Kerahasiaan secret Connector Hub", () => {
  it("API key / password / secret webhook tidak bocor ke respons, log aplikasi, audit log, maupun DB (selain ciphertext)", async () => {
    const KEY = "sk-live-SENTINEL-KEY-9f8e7d6c5b4a";
    const PASS = "SMTP-PASS-SENTINEL-1a2b3c4d";
    const captured: unknown[] = [];
    const spies = (["info", "warn", "error", "debug", "trace", "fatal"] as const).map((lvl) =>
      vi
        .spyOn(logger, lvl)
        .mockImplementation(((...args: unknown[]) => void captured.push(args)) as never),
    );
    try {
      await makeOrg("Org A");
      const responses: unknown[] = [];
      responses.push(
        await connA.saveAiConnector({ provider: "openai", apiKey: KEY, model: "gpt-4.1-mini" }),
      );
      generateText.mockRejectedValueOnce(
        Object.assign(new Error(`Incorrect API key provided: ${KEY}`), { statusCode: 401 }),
      );
      responses.push(await connA.testAiConnector({ provider: "openai" }));
      responses.push(
        await emailA.saveEmailConnector({
          provider: "smtp",
          host: "smtp.example.com",
          port: 587,
          secure: false,
          user: "u",
          pass: PASS,
          from: "CRM <a@example.com>",
        }),
      );
      const hook = await hookA.generateWebhook({});
      responses.push(
        await aiLead.draftLeadFromText({ text: "Teks lead yang cukup panjang" }).catch(() => null),
      );
      responses.push(await connQ.listConnectors(await ctxNow()));
      responses.push(await hookQ.getWebhookView(await ctxNow()));
      const secret = hook.ok ? hook.data.secret : "";
      const blob = (x: unknown) => JSON.stringify(x);

      // Respons list/status tidak berisi rahasia (secret webhook hanya muncul SEKALI pada respons generate)
      for (const r of [responses[0], responses[1], responses[2], responses[4], responses[5]]) {
        expect(blob(r)).not.toContain(KEY);
        expect(blob(r)).not.toContain(PASS);
        expect(blob(r)).not.toContain(secret);
      }
      expect(blob(captured)).not.toContain(KEY);
      expect(blob(captured)).not.toContain(PASS);
      expect(blob(captured)).not.toContain(secret);
      expect(blob(await testPrisma.auditLog.findMany())).not.toMatch(
        new RegExp(`${KEY}|${PASS}|${secret}`),
      );
      expect(blob(await testPrisma.aiCallLog.findMany())).not.toContain(KEY);
      for (const c of await testPrisma.tenantConnector.findMany()) {
        expect(c.configEncrypted).toMatch(/^v1\./);
        expect(blob(c)).not.toContain(KEY);
        expect(blob(c)).not.toContain(PASS);
      }
      const hookRow = await testPrisma.inboundWebhook.findFirstOrThrow();
      expect(hookRow.secretEncrypted).not.toContain(secret);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
