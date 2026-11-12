import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";
import { mails } from "../helpers/mails";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const ch = await import("@/modules/omnichannel/server/channel");
const chA = await import("@/modules/omnichannel/server/actions");
const tl = await import("@/modules/omnichannel/server/timeline");
const waA = await import("@/modules/whatsapp/server/actions");
const waConn = await import("@/modules/whatsapp/server/connector-actions");
const { signPayload } = await import("@/modules/whatsapp/server/receive");
const { POST } = await import("@/app/api/webhooks/whatsapp/[publicId]/route");
const q = await import("@/modules/whatsapp/server/queries");

const ctxNow = async () => (await getTenantContext())!;
const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;

beforeEach(async () => {
  await resetDb();
  fetchMock.mockReset();
  mails.length = 0;
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

const email = (handle: string, over: Record<string, unknown> = {}) => ({
  kind: "email" as const,
  handle,
  direction: "in" as const,
  body: "Subjek\n\nIsi email",
  email: handle,
  channelType: "email_gmail",
  ...over,
});

async function team(orgId: string) {
  const a = await addUserWithRole(orgId, "sales_rep", "Rep A");
  const b = await addUserWithRole(orgId, "sales_rep", "Rep B");
  const c = await addUserWithRole(orgId, "sales_rep", "Rep C");
  return [a, b, c].sort((x, y) => x.id.localeCompare(y.id));
}

describe("Omnichannel — percakapan multi-kanal (plan 3.6)", () => {
  it("email masuk: membuat percakapan kind=email, tertaut ke contact lewat email, idempoten per externalId", async () => {
    const o = await makeOrg("Org A");
    const contact = await testPrisma.contact.create({
      data: { organizationId: o.orgId, name: "Budi", email: "Budi@Klien.test" },
    });
    const db = (await ctxNow()).db;
    const r1 = await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { externalId: "gmail:1", name: "Budi" }),
    );
    expect(r1).toMatchObject({ duplicate: false, created: true });
    const r2 = await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { externalId: "gmail:1" }),
    );
    expect(r2).toMatchObject({ duplicate: true, conversationId: r1.conversationId });
    const r3 = await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { externalId: "gmail:2", body: "Balasan" }),
    );
    expect(r3).toMatchObject({
      duplicate: false,
      created: false,
      conversationId: r1.conversationId,
    });
    const conv = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: r1.conversationId },
    });
    expect(conv).toMatchObject({
      kind: "email",
      contactId: contact.id,
      unreadCount: 2,
      phone: null,
    });
    expect(await testPrisma.message.count()).toBe(2);
    // pesan lama tidak memundurkan "pesan terakhir"
    await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { externalId: "gmail:0", at: new Date("2020-01-01") }),
    );
    const after = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: r1.conversationId },
    });
    expect(after.lastMessageAt.getTime()).toBeGreaterThan(new Date("2025-01-01").getTime());
  });

  it("routing default tanpa aturan = belum ditugaskan; round robin membagi merata (termasuk paralel)", async () => {
    const o = await makeOrg("Org A");
    const [a, b, c] = await team(o.orgId);
    const db = (await ctxNow()).db;
    const first = await ch.ingestChannelMessage(db, email("x0@mail.test"));
    expect(
      (await testPrisma.conversation.findUniqueOrThrow({ where: { id: first.conversationId } }))
        .assigneeId,
    ).toBeNull();

    expect(
      await chA.saveChannelRouting({
        kind: "email",
        strategy: "round_robin",
        pool: [a!.id, b!.id, c!.id],
      }),
    ).toMatchObject({ ok: true });
    const seq: (string | null)[] = [];
    for (let i = 1; i <= 6; i++) {
      const r = await ch.ingestChannelMessage(db, email(`x${i}@mail.test`));
      seq.push(
        (await testPrisma.conversation.findUniqueOrThrow({ where: { id: r.conversationId } }))
          .assigneeId,
      );
    }
    expect(seq).toEqual([a, b, c, a, b, c].map((u) => u!.id));
    // paralel: 6 percakapan baru → tiap anggota tepat 2
    const par = await Promise.all(
      Array.from({ length: 6 }, (_, i) => ch.ingestChannelMessage(db, email(`p${i}@mail.test`))),
    );
    const owners = await testPrisma.conversation.findMany({
      where: { id: { in: par.map((p) => p.conversationId) } },
      select: { assigneeId: true },
    });
    const count = new Map<string | null, number>();
    for (const x of owners) count.set(x.assigneeId, (count.get(x.assigneeId) ?? 0) + 1);
    expect([...count.values()].sort()).toEqual([2, 2, 2]);
    // penerima mendapat notifikasi in-app
    expect(
      await testPrisma.notification.count({ where: { type: "conversation_assigned" } }),
    ).toBeGreaterThanOrEqual(12);
  });

  it("sticky_owner: ke pemilik contact; tanpa pemilik jatuh ke pool; WhatsApp memakai aturan kanalnya sendiri", async () => {
    const o = await makeOrg("Org A");
    const [a, b] = await team(o.orgId);
    await testPrisma.contact.create({
      data: {
        organizationId: o.orgId,
        name: "Siti",
        email: "siti@k.test",
        phone: "081234567890",
        phoneNormalized: "6281234567890",
        ownerId: b!.id,
      },
    });
    await chA.saveChannelRouting({ kind: "email", strategy: "sticky_owner", pool: [a!.id] });
    const db = (await ctxNow()).db;
    const r1 = await ch.ingestChannelMessage(db, email("siti@k.test"));
    expect(
      (await testPrisma.conversation.findUniqueOrThrow({ where: { id: r1.conversationId } }))
        .assigneeId,
    ).toBe(b!.id);
    const r2 = await ch.ingestChannelMessage(db, email("asing@k.test"));
    expect(
      (await testPrisma.conversation.findUniqueOrThrow({ where: { id: r2.conversationId } }))
        .assigneeId,
    ).toBe(a!.id);

    // WhatsApp: aturan kanal whatsapp (sticky) → pemilik contact; kanal email tak terpengaruh
    await chA.saveChannelRouting({ kind: "whatsapp", strategy: "sticky_owner", pool: [] });
    const c = await waConn.saveWhatsappConnector({
      provider: "fonnte",
      token: "fonnte-token-123456",
    });
    if (!c.ok) throw new Error(c.error);
    const raw = JSON.stringify({ sender: "081234567890", message: "Halo", id: "w1", name: "Siti" });
    const res = await POST(
      new NextRequest(`http://localhost/api/webhooks/whatsapp/${c.data.publicId}`, {
        method: "POST",
        body: raw,
        headers: {
          "content-type": "application/json",
          "x-signature": `sha256=${signPayload(c.data.webhookSecret!, raw)}`,
        },
      }),
      { params: Promise.resolve({ publicId: c.data.publicId }) } as never,
    );
    expect(res.status).toBe(200);
    const wa = await testPrisma.conversation.findFirstOrThrow({ where: { kind: "whatsapp" } });
    expect(wa).toMatchObject({ assigneeId: b!.id, handle: "6281234567890" });
  });

  it("izin routing: hanya Owner/Admin; pool wajib anggota aktif yang dapat menangani inbox (bukan viewer/tenant lain)", async () => {
    const o = await makeOrg("Org A");
    const [a] = await team(o.orgId);
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Viewer");
    actAs(mgr);
    expect(
      await chA.saveChannelRouting({ kind: "email", strategy: "round_robin", pool: [] }),
    ).toMatchObject({ ok: false });
    actAs(o.owner);
    expect(
      await chA.saveChannelRouting({ kind: "email", strategy: "round_robin", pool: [viewer.id] }),
    ).toMatchObject({ ok: false });
    const other = await makeOrg("Org B");
    actAs(o.owner);
    expect(
      await chA.saveChannelRouting({
        kind: "email",
        strategy: "round_robin",
        pool: [other.owner.id],
      }),
    ).toMatchObject({ ok: false });
    expect(
      await chA.saveChannelRouting({ kind: "email", strategy: "round_robin", pool: [a!.id] }),
    ).toMatchObject({ ok: true });
    expect(await testPrisma.auditLog.count({ where: { action: "channel_routing.updated" } })).toBe(
      1,
    );
  });

  it("balas email dari inbox lewat connector email (aksi eksplisit); kanal lain hanya dicatat", async () => {
    const o = await makeOrg("Org A");
    const db = (await ctxNow()).db;
    const r = await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { body: "Penawaran\n\nMohon info harga" }),
    );
    const sent = await waA.sendConversationMessage({
      conversationId: r.conversationId,
      body: "Baik, kami kirim hari ini.",
    });
    expect(sent.ok).toBe(true);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "budi@klien.test", subject: "Re: Penawaran" });
    expect(await testPrisma.message.count({ where: { direction: "out", status: "sent" } })).toBe(1);
    // percakapan manual: tidak ada email/gateway
    const lead = await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "Lead IG", ownerId: o.owner.id },
    });
    const m = await chA.logChannelMessage({
      leadId: lead.id,
      channelLabel: "Instagram",
      direction: "in",
      body: "Kak, harga?",
    });
    expect(m.ok).toBe(true);
    const conv = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: (m as { data: { conversationId: string } }).data.conversationId },
    });
    expect(conv).toMatchObject({ kind: "other", channelLabel: "Instagram", leadId: lead.id });
    const out = await waA.sendConversationMessage({ conversationId: conv.id, body: "Halo kak" });
    expect(out.ok).toBe(true);
    expect(mails).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    // filter kanal di inbox
    const ctx = await ctxNow();
    expect((await q.listConversations(ctx, { kind: "email" })).map((c) => c.kind)).toEqual([
      "email",
    ]);
    expect((await q.listConversations(ctx, { kind: "other" })).map((c) => c.kind)).toEqual([
      "other",
    ]);
    expect(await q.listConversations(ctx, {})).toHaveLength(2);
  });

  it("catat percakapan manual: rep hanya untuk lead miliknya; viewer ditolak", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Viewer");
    const mine = await testPrisma.lead.create({
      data: { organizationId: o.orgId, name: "Milik", ownerId: rep.id },
    });
    const other = await testPrisma.lead.create({ data: { organizationId: o.orgId, name: "Lain" } });
    const payload = (leadId: string) => ({
      leadId,
      channelLabel: "Telegram",
      direction: "out" as const,
      body: "tes",
    });
    actAs(rep);
    expect(await chA.logChannelMessage(payload(mine.id))).toMatchObject({ ok: true });
    expect(await chA.logChannelMessage(payload(other.id))).toMatchObject({ ok: false });
    actAs(viewer);
    expect(await chA.logChannelMessage(payload(mine.id))).toMatchObject({ ok: false });
  });

  it("timeline terpadu: pesan WA + email + kanal lain + aktivitas dalam satu urutan, tanpa duplikat auto-log", async () => {
    const o = await makeOrg("Org A");
    const contact = await testPrisma.contact.create({
      data: {
        organizationId: o.orgId,
        name: "Budi",
        email: "budi@klien.test",
        phone: "081234567890",
        phoneNormalized: "6281234567890",
      },
    });
    const company = await testPrisma.company.create({
      data: { organizationId: o.orgId, name: "PT Klien" },
    });
    await testPrisma.contactCompany.create({
      data: { organizationId: o.orgId, contactId: contact.id, companyId: company.id },
    });
    const t = (d: string) => new Date(`2026-11-${d}T03:00:00Z`);
    const wa = await testPrisma.conversation.create({
      data: {
        organizationId: o.orgId,
        channel: "whatsapp_fonnte",
        kind: "whatsapp",
        handle: "6281234567890",
        phone: "081234567890",
        phoneNormalized: "6281234567890",
        contactId: contact.id,
      },
    });
    await testPrisma.message.create({
      data: {
        organizationId: o.orgId,
        conversationId: wa.id,
        direction: "in",
        body: "Halo, minta penawaran",
        status: "received",
        createdAt: t("01"),
      },
    });
    // aktivitas auto-log pesan WA di atas → tidak boleh tampil ganda
    await testPrisma.activity.create({
      data: {
        organizationId: o.orgId,
        type: "whatsapp",
        subject: "WhatsApp masuk: Halo, minta penawaran",
        status: "done",
        completedAt: t("01"),
        contactId: contact.id,
      },
    });
    await testPrisma.activity.create({
      data: {
        organizationId: o.orgId,
        type: "call",
        subject: "Telepon penawaran",
        status: "done",
        completedAt: t("02"),
        contactId: contact.id,
      },
    });
    const db = (await ctxNow()).db;
    const e = await ch.ingestChannelMessage(
      db,
      email("budi@klien.test", { externalId: "gmail:G1", at: t("03"), contactId: contact.id }),
    );
    // aktivitas email hasil sinkron Gmail yang sama → tidak ganda
    const act = await testPrisma.activity.create({
      data: {
        organizationId: o.orgId,
        type: "email",
        subject: "Email masuk: Subjek",
        status: "done",
        completedAt: t("03"),
        contactId: contact.id,
      },
    });
    const integ = await testPrisma.googleIntegration.create({
      data: {
        organizationId: o.orgId,
        userId: o.owner.id,
        googleEmail: "saya@gmail.test",
        scopes: "calendar gmail",
        accessTokenEncrypted: "x",
        refreshTokenEncrypted: "x",
        status: "active",
      } as never,
    });
    await testPrisma.emailSyncLog.create({
      data: {
        organizationId: o.orgId,
        integrationId: integ.id,
        messageId: "G1",
        activityId: act.id,
      },
    });
    await chA.logChannelMessage({
      contactId: contact.id,
      channelLabel: "Instagram",
      direction: "in",
      body: "DM: ada promo?",
    });
    void e;

    const ctx = await ctxNow();
    const items = await tl.getUnifiedTimeline(ctx, { type: "contact", id: contact.id });
    const channels = items.map((i) => i.channel);
    expect(channels.sort()).toEqual(["call", "email", "other", "whatsapp"].sort());
    expect(items.filter((i) => i.channel === "whatsapp")).toHaveLength(1);
    expect(items.filter((i) => i.channel === "email")).toHaveLength(1);
    expect(items[0]!.at.getTime()).toBeGreaterThanOrEqual(items[items.length - 1]!.at.getTime());
    // company mengagregasi percakapan para contact-nya
    const co = await tl.getUnifiedTimeline(ctx, { type: "company", id: company.id });
    expect(co.map((i) => i.channel).sort()).toEqual(["email", "other", "whatsapp"]);
  });

  it("timeline menghormati izin & tenant: rep tak melihat percakapan orang lain; viewer tanpa akses percakapan hanya aktivitas; lintas tenant ditolak", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Viewer");
    const contact = await testPrisma.contact.create({
      data: { organizationId: o.orgId, name: "Budi", email: "b@k.test", ownerId: rep.id },
    });
    await testPrisma.activity.create({
      data: {
        organizationId: o.orgId,
        type: "note",
        subject: "Catatan",
        status: "done",
        contactId: contact.id,
        ownerId: rep.id,
      },
    });
    const db = (await ctxNow()).db;
    const r = await ch.ingestChannelMessage(db, email("b@k.test"));
    await testPrisma.conversation.update({
      where: { id: r.conversationId },
      data: { assigneeId: o.owner.id },
    });
    actAs(rep);
    expect(
      (await tl.getUnifiedTimeline(await ctxNow(), { type: "contact", id: contact.id })).map(
        (i) => i.channel,
      ),
    ).toEqual(["note"]);
    actAs(viewer);
    expect(
      (await tl.getUnifiedTimeline(await ctxNow(), { type: "contact", id: contact.id })).map(
        (i) => i.channel,
      ),
    ).toEqual(["note"]);
    actAs(o.owner);
    expect(
      (await tl.getUnifiedTimeline(await ctxNow(), { type: "contact", id: contact.id }))
        .map((i) => i.channel)
        .sort(),
    ).toEqual(["email", "note"]);
    await makeOrg("Org B");
    await expect(
      tl.getUnifiedTimeline(await ctxNow(), { type: "contact", id: contact.id }),
    ).rejects.toThrow();
    void idOf;
  });
});
