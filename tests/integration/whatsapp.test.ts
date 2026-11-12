import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const { decryptSecret } = await import("@/lib/crypto");
const connectorActions = await import("@/modules/whatsapp/server/connector-actions");
const actions = await import("@/modules/whatsapp/server/actions");
const q = await import("@/modules/whatsapp/server/queries");
const { signPayload } = await import("@/modules/whatsapp/server/receive");
const { POST } = await import("@/app/api/webhooks/whatsapp/[publicId]/route");
const contactActions = await import("@/modules/contacts/server/actions");
const { listConnectors } = await import("@/modules/connectors/server/queries");
const { isPrivateIp } = await import("@/lib/ssrf");

const ctxNow = async () => (await getTenantContext())!;
const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;

beforeEach(async () => {
  await resetDb();
  fetchMock.mockReset();
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

/** Hubungkan Fonnte dan kembalikan publicId + secret webhook. */
async function connect() {
  const res = await connectorActions.saveWhatsappConnector({
    provider: "fonnte",
    token: "fonnte-token-123456",
  });
  if (!res.ok) throw new Error(res.error);
  return { publicId: res.data.publicId, secret: res.data.webhookSecret! };
}

async function inbound(
  publicId: string,
  secret: string,
  payload: unknown,
  opts: { sign?: boolean; token?: string; badSig?: boolean } = {},
) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.sign !== false && !opts.token)
    headers["x-signature"] = `sha256=${signPayload(opts.badSig ? "salah" : secret, raw)}`;
  const url = `http://localhost/api/webhooks/whatsapp/${publicId}${opts.token ? `?token=${opts.token}` : ""}`;
  const res = await POST(new NextRequest(url, { method: "POST", body: raw, headers }), {
    params: Promise.resolve({ publicId }),
  } as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const msg = (over: Record<string, unknown> = {}) => ({
  sender: "081234567890",
  message: "Halo, tanya harga",
  name: "Budi",
  id: `m-${Math.random()}`,
  ...over,
});

describe("Connector WhatsApp", () => {
  it("secret webhook tampil sekali; token & secret terenkripsi dan tidak bocor ke daftar connector", async () => {
    const o = await makeOrg("Org A");
    const { publicId, secret } = await connect();
    expect(secret).toMatch(/^wasec_/);
    const again = await connectorActions.saveWhatsappConnector({ provider: "fonnte" });
    expect(again).toMatchObject({ ok: true, data: { publicId, webhookSecret: undefined } });
    const view = JSON.stringify(await listConnectors(await ctxNow()));
    expect(view).not.toContain("fonnte-token-123456");
    expect(view).not.toContain(secret);
    const row = await testPrisma.tenantConnector.findFirstOrThrow({
      where: { type: "whatsapp_fonnte" },
    });
    expect(row.configEncrypted).not.toContain("fonnte-token");
    const cfg = JSON.parse(decryptSecret(row.configEncrypted, `${o.orgId}:whatsapp_fonnte`));
    expect(cfg).toMatchObject({ token: "fonnte-token-123456", webhookSecret: secret });
    const audit = JSON.stringify(await testPrisma.auditLog.findMany());
    expect(audit).not.toContain("fonnte-token-123456");
    expect(audit).not.toContain(secret);
    // putar secret → secret lama tidak berlaku
    const rot = await connectorActions.rotateWhatsappSecret({ provider: "fonnte" });
    const fresh = (rot as { data: { webhookSecret: string } }).data.webhookSecret;
    expect(fresh).not.toBe(secret);
    expect((await inbound(publicId, secret, msg())).status).toBe(401);
    expect((await inbound(publicId, fresh, msg())).status).toBe(200);
  });

  it("gateway HTTP kustom menolak URL non-HTTPS dan alamat privat (SSRF)", async () => {
    await makeOrg("Org A");
    const bad = [
      "http://example.com/send",
      "https://127.0.0.1/send",
      "https://10.0.0.5/x",
      "https://169.254.169.254/latest",
      "https://user:pw@example.com/x",
      "ftp://x.y/z",
    ];
    for (const apiUrl of bad) {
      expect(
        await connectorActions.saveWhatsappConnector({
          provider: "http",
          token: "tok-123456",
          apiUrl,
        }),
      ).toMatchObject({ ok: false });
    }
    expect(
      [
        "127.0.0.1",
        "10.1.2.3",
        "172.20.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "::1",
        "fd00::1",
        "::ffff:10.0.0.1",
      ].every(isPrivateIp),
    ).toBe(true);
    expect(["8.8.8.8", "1.1.1.1"].some(isPrivateIp)).toBe(false);
    expect(
      await connectorActions.saveWhatsappConnector({
        provider: "http",
        token: "tok-123456",
        apiUrl: "https://8.8.8.8/send",
      }),
    ).toMatchObject({ ok: true });
  });

  it("Test Connection memanggil gateway dan mencatat hasil tanpa membocorkan token", async () => {
    await makeOrg("Org A");
    await connect();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: false, reason: "invalid token fonnte-token-123456" }), {
        status: 200,
      }),
    );
    const bad = await connectorActions.testWhatsappConnector({ provider: "fonnte" });
    expect(bad).toMatchObject({ ok: true, data: { ok: false } });
    expect(JSON.stringify(bad)).not.toContain("fonnte-token-123456");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: true }), { status: 200 }),
    );
    expect(await connectorActions.testWhatsappConnector({ provider: "fonnte" })).toMatchObject({
      ok: true,
      data: { ok: true },
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("fonnte-token-123456");
  });

  it("hanya Owner/Admin mengelola connector", async () => {
    const o = await makeOrg("Org A");
    const rep = await addUserWithRole(o.orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(
      await connectorActions.saveWhatsappConnector({ provider: "fonnte", token: "abcdef123456" }),
    ).toMatchObject({ ok: false });
  });
});

describe("Webhook masuk", () => {
  it("signature valid → percakapan & pesan tersimpan; tidak pernah memicu pengiriman otomatis", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    const r = await inbound(publicId, secret, msg({ id: "x1" }));
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    const conv = await testPrisma.conversation.findFirstOrThrow();
    expect(conv).toMatchObject({
      phoneNormalized: "6281234567890",
      displayName: "Budi",
      unreadCount: 1,
      status: "open",
    });
    expect(await testPrisma.message.count({ where: { direction: "in" } })).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await testPrisma.message.count({ where: { direction: "out" } })).toBe(0);
  });

  it("menolak: signature salah, tanpa signature, token salah, id tak dikenal, JSON rusak; token query valid diterima", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    expect((await inbound(publicId, secret, msg(), { badSig: true })).status).toBe(401);
    expect((await inbound(publicId, secret, msg(), { sign: false })).status).toBe(401);
    expect((await inbound(publicId, secret, msg(), { token: "salah" })).status).toBe(401);
    expect((await inbound("tidak-ada", secret, msg())).status).toBe(404);
    expect((await inbound(publicId, secret, "{bukan json")).status).toBe(400);
    expect(await testPrisma.conversation.count()).toBe(0);
    expect((await inbound(publicId, secret, msg(), { token: secret })).status).toBe(200);
    // payload tanpa teks/pengirim diabaikan (200, tidak membuat data)
    expect(await inbound(publicId, secret, { sender: "081", message: "" })).toMatchObject({
      status: 200,
      body: { ignored: true },
    });
    expect(await testPrisma.conversation.count()).toBe(1);
  });

  it("pesan ganda (externalId sama), termasuk paralel, hanya tersimpan sekali", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    const payload = msg({ id: "dup-1" });
    await Promise.all([1, 2, 3, 4].map(() => inbound(publicId, secret, payload)));
    expect(await testPrisma.message.count()).toBe(1);
    expect((await testPrisma.conversation.findFirstOrThrow()).unreadCount).toBe(1);
    expect(await testPrisma.conversation.count()).toBe(1);
  });

  it("menautkan ke contact via telepon ternormalisasi, mencatat ke timeline, dan menautkan belakangan", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    await inbound(publicId, secret, msg({ id: "a" }));
    expect((await testPrisma.conversation.findFirstOrThrow()).contactId).toBeNull();
    expect(await testPrisma.activity.count()).toBe(0);
    const c = idOf(
      await contactActions.createContact({ name: "Budi Santoso", phone: "+62 812-3456-7890" }),
    );
    await inbound(publicId, secret, msg({ id: "b", message: "Saya lanjut" }));
    const conv = await testPrisma.conversation.findFirstOrThrow();
    expect(conv.contactId).toBe(c);
    const acts = await testPrisma.activity.findMany();
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ type: "whatsapp", contactId: c, status: "done" });
    expect(acts[0].body).toContain("Saya lanjut");
  });

  it("isi pesan HTML di-escape pada timeline (anti XSS)", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    await contactActions.createContact({ name: "Budi", phone: "081234567890" });
    await inbound(publicId, secret, msg({ message: "<script>alert(1)</script>" }));
    const a = await testPrisma.activity.findFirstOrThrow();
    expect(a.body).not.toContain("<script>");
    expect(a.body).toContain("&lt;script&gt;");
  });

  it("isolasi tenant: webhook org A hanya menulis ke org A; org B tidak melihat percakapan A", async () => {
    const a = await makeOrg("Org A");
    const wa = await connect();
    const b = await makeOrg("Org B");
    actAs(b.owner);
    const wb = await connect();
    expect(wa.publicId).not.toBe(wb.publicId);
    await inbound(wa.publicId, wa.secret, msg({ id: "ta" }));
    // secret org A di URL org B → ditolak
    expect((await inbound(wb.publicId, wa.secret, msg({ id: "tb" }))).status).toBe(401);
    expect((await q.listConversations(await ctxNow())).length).toBe(0);
    const convA = await testPrisma.conversation.findFirstOrThrow({
      where: { organizationId: a.orgId },
    });
    await expect(q.getConversation(await ctxNow(), convA.id)).rejects.toThrow();
    expect(
      await actions.sendWhatsappMessage({ conversationId: convA.id, body: "bocor" }),
    ).toMatchObject({ ok: false });
    expect(
      await actions.assignConversation({ id: convA.id, assigneeId: b.owner.id }),
    ).toMatchObject({ ok: false });
    expect(await actions.setConversationStatus({ id: convA.id, status: "closed" })).toMatchObject({
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    actAs(a.owner);
    expect((await q.listConversations(await ctxNow())).length).toBe(1);
  });
});

describe("Pesan keluar & penugasan", () => {
  it("terkirim hanya lewat aksi pengguna: memanggil gateway, mencatat status, mengambil percakapan, log timeline", async () => {
    const o = await makeOrg("Org A");
    const { publicId, secret } = await connect();
    await contactActions.createContact({ name: "Budi", phone: "081234567890" });
    await inbound(publicId, secret, msg());
    const conv = await testPrisma.conversation.findFirstOrThrow();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: true, id: ["abc"] }), { status: 200 }),
    );
    const res = await actions.sendWhatsappMessage({
      conversationId: conv.id,
      body: "Halo Pak Budi",
    });
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.fonnte.com/send");
    expect(String(init.body)).toContain("target=6281234567890");
    expect(init.headers.Authorization).toBe("fonnte-token-123456");
    const out = await testPrisma.message.findFirstOrThrow({ where: { direction: "out" } });
    expect(out).toMatchObject({ status: "sent", sentBy: o.owner.id });
    const after = await testPrisma.conversation.findFirstOrThrow();
    expect(after).toMatchObject({ assigneeId: o.owner.id, unreadCount: 0 });
    expect(await testPrisma.activity.count({ where: { type: "whatsapp" } })).toBe(2);
    // audit tidak memuat isi pesan
    expect(
      JSON.stringify(
        await testPrisma.auditLog.findMany({ where: { action: "whatsapp.message_sent" } }),
      ),
    ).not.toContain("Halo Pak Budi");
  });

  it("gateway menolak → pesan ditandai failed, error terlihat, percakapan tidak maju; tanpa connector → ditolak", async () => {
    await makeOrg("Org A");
    // tanpa connector: percakapan dibuat langsung ke DB
    const orgId = (await testPrisma.organization.findFirstOrThrow()).id;
    const conv = await testPrisma.conversation.create({
      data: {
        organizationId: orgId,
        channel: "whatsapp_fonnte",
        phone: "0812",
        phoneNormalized: "62812999",
        lastMessagePreview: "x",
      },
    });
    expect(
      await actions.sendWhatsappMessage({ conversationId: conv.id, body: "Halo" }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.message.count()).toBe(0);
    await connect();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: false, reason: "device disconnected" }), {
        status: 200,
      }),
    );
    const res = await actions.sendWhatsappMessage({ conversationId: conv.id, body: "Halo" });
    expect(res).toMatchObject({ ok: false });
    expect((res as { error: string }).error).toMatch(/device disconnected/);
    expect(await testPrisma.message.findFirstOrThrow()).toMatchObject({
      status: "failed",
      error: "device disconnected",
    });
    expect((await testPrisma.conversation.findFirstOrThrow()).lastMessagePreview).toBe("x");
  });

  it("izin: rep hanya melihat/membalas miliknya atau yang belum ditugaskan; viewer tidak bisa; manager melihat semua", async () => {
    const o = await makeOrg("Org A");
    const rep1 = await addUserWithRole(o.orgId, "sales_rep", "Rep1");
    const rep2 = await addUserWithRole(o.orgId, "sales_rep", "Rep2");
    const viewer = await addUserWithRole(o.orgId, "viewer", "Vi");
    const mgr = await addUserWithRole(o.orgId, "sales_manager", "Mgr");
    actAs(o.owner);
    await connect();
    const mk = (n: string, assigneeId: string | null) =>
      testPrisma.conversation.create({
        data: {
          organizationId: o.orgId,
          channel: "whatsapp_fonnte",
          phone: n,
          phoneNormalized: `62${n}`,
          assigneeId,
          lastMessagePreview: n,
        },
      });
    const c1 = await mk("811111", rep1.id);
    const c2 = await mk("822222", rep2.id);
    const c3 = await mk("833333", null);
    const names = async (u: Parameters<typeof actAs>[0]) => {
      actAs(u);
      return (await q.listConversations(await ctxNow())).map((c) => c.id).sort();
    };
    expect(await names(rep1)).toEqual([c1.id, c3.id].sort());
    expect(await names(mgr)).toHaveLength(3);
    actAs(viewer);
    await expect(q.listConversations(await ctxNow())).rejects.toThrow();
    expect(await actions.sendWhatsappMessage({ conversationId: c1.id, body: "x" })).toMatchObject({
      ok: false,
    });
    actAs(rep1);
    await expect(q.getConversation(await ctxNow(), c2.id)).rejects.toThrow();
    expect(await actions.sendWhatsappMessage({ conversationId: c2.id, body: "x" })).toMatchObject({
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    // claim: rep boleh mengambil yang belum ditugaskan, tidak boleh menugaskan ke orang lain
    expect(await actions.assignConversation({ id: c3.id, assigneeId: rep2.id })).toMatchObject({
      ok: false,
    });
    expect(await actions.assignConversation({ id: c3.id, assigneeId: rep1.id })).toMatchObject({
      ok: true,
    });
    expect(await actions.assignConversation({ id: c3.id, assigneeId: null })).toMatchObject({
      ok: true,
    });
    // manager boleh menugaskan; target harus anggota aktif organisasi
    actAs(mgr);
    expect(await actions.assignConversation({ id: c3.id, assigneeId: rep2.id })).toMatchObject({
      ok: true,
    });
    const stranger = await makeOrg("Org B");
    actAs(mgr);
    expect(
      await actions.assignConversation({ id: c3.id, assigneeId: stranger.owner.id }),
    ).toMatchObject({ ok: false });
  });

  it("buat lead dari percakapan: tertaut, owner = penangani, sumber WhatsApp; tidak dobel", async () => {
    const o = await makeOrg("Org A");
    const { publicId, secret } = await connect();
    await inbound(publicId, secret, msg({ name: "Calon Pembeli" }));
    const conv = await testPrisma.conversation.findFirstOrThrow();
    const res = await actions.createLeadFromConversation({ id: conv.id });
    expect(res.ok).toBe(true);
    const lead = await testPrisma.lead.findFirstOrThrow({ include: { source: true } });
    expect(lead).toMatchObject({
      name: "Calon Pembeli",
      phoneNormalized: "6281234567890",
      ownerId: o.owner.id,
    });
    expect(lead.source?.name).toBe("WhatsApp");
    expect((await testPrisma.conversation.findFirstOrThrow()).leadId).toBe(lead.id);
    expect(await actions.createLeadFromConversation({ id: conv.id })).toMatchObject({ ok: false });
    // pesan berikutnya masuk ke timeline lead
    await inbound(publicId, secret, msg({ id: "next", message: "Lanjut" }));
    expect(await testPrisma.activity.count({ where: { leadId: lead.id, type: "whatsapp" } })).toBe(
      1,
    );
  });

  it("menutup percakapan lalu pesan baru membukanya kembali; unread direset saat dibaca", async () => {
    await makeOrg("Org A");
    const { publicId, secret } = await connect();
    await inbound(publicId, secret, msg({ id: "1" }));
    const conv = await testPrisma.conversation.findFirstOrThrow();
    await actions.setConversationStatus({ id: conv.id, status: "closed" });
    expect((await q.listConversations(await ctxNow())).length).toBe(0);
    expect((await q.listConversations(await ctxNow(), { status: "closed" })).length).toBe(1);
    await inbound(publicId, secret, msg({ id: "2" }));
    expect((await testPrisma.conversation.findFirstOrThrow()).status).toBe("open");
    expect(await q.unreadTotal(await ctxNow())).toBe(2);
    await actions.markConversationRead({ id: conv.id });
    expect(await q.unreadTotal(await ctxNow())).toBe(0);
  });
});
