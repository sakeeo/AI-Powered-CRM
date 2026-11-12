import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { redis } = await import("@/lib/redis");
const { closeQueues, getQueue, QUEUES } = await import("@/lib/queue");
const google = await import("@/lib/google");
const { decryptSecret } = await import("@/lib/crypto");
const { getTenantContext } = await import("@/lib/context");
const activityActions = await import("@/modules/activities/server/actions");
const googleActions = await import("@/modules/integrations/server/google-actions");

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | undefined;
const calls: { url: string; method: string; body?: string }[] = [];
let handlers: Handler[] = [];
fetchMock.mockImplementation(async (input: unknown, init: RequestInit = {}) => {
  const url = String(input);
  calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
  for (const h of handlers) {
    const r = await h(url, init);
    if (r) return r;
  }
  return json({ error: "unhandled " + url }, 500);
});
const on = (h: Handler) => handlers.unshift(h);
const callsTo = (re: RegExp, method?: string) =>
  calls.filter((c) => re.test(c.url) && (!method || c.method === method));

beforeEach(async () => {
  await resetDb();
  calls.length = 0;
  handlers = [];
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
  await getQueue(QUEUES.calendar).obliterate({ force: true });
});
afterAll(async () => {
  await getQueue(QUEUES.calendar).obliterate({ force: true });
  await closeQueues();
  await redis.quit();
  await testPrisma.$disconnect();
});

async function connect(opts: { syncEmail?: boolean; expired?: boolean; scopes?: string } = {}) {
  const org = await makeOrg(`Org ${Math.random().toString(36).slice(2, 6)}`);
  const tokens = google.encryptTokens(
    { organizationId: org.orgId, userId: org.owner.id },
    { refresh: "refresh-1", access: "access-1" },
  );
  const integ = await testPrisma.googleIntegration.create({
    data: {
      organizationId: org.orgId,
      userId: org.owner.id,
      googleEmail: "saya@gmail.test",
      scopes: opts.scopes ?? `openid email ${google.SCOPE_CALENDAR} ${google.SCOPE_GMAIL}`,
      syncEmail: opts.syncEmail ?? false,
      ...tokens,
      accessExpiresAt: new Date(Date.now() + (opts.expired ? -1000 : 3_600_000)),
    },
  });
  return { org, integ };
}
const mkActivity = (orgId: string, userId: string, over: Record<string, unknown> = {}) =>
  testPrisma.activity.create({
    data: {
      organizationId: orgId,
      type: "meeting",
      subject: "Meeting Klien",
      status: "open",
      dueAt: new Date(Date.now() + 86_400_000),
      ownerId: userId,
      ...over,
    },
  });
const eventOk =
  (etag = '"e1"') =>
  (url: string, init: RequestInit) =>
    /calendars\/primary\/events/.test(url) && (init.method === "POST" || init.method === "PATCH")
      ? json({ id: (JSON.parse(String(init.body)) as { id: string }).id, etag })
      : undefined;

describe("OAuth state", () => {
  it("state bertanda tangan: valid diterima; dimodifikasi/kedaluwarsa/asal-asalan ditolak", () => {
    const s = google.signState({ u: "u1", o: "o1", e: true }, 1_000);
    expect(google.verifyState(s, 2_000)).toMatchObject({ u: "u1", o: "o1", e: true });
    expect(google.verifyState(s, 1_000 + 11 * 60_000)).toBeNull();
    const [body, sig] = s.split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "korban", o: "o1", e: true, x: 9e15, n: "x" }),
    ).toString("base64url");
    expect(google.verifyState(`${forged}.${sig}`, 2_000)).toBeNull();
    expect(google.verifyState(`${body}.salah`, 2_000)).toBeNull();
    expect(google.verifyState("", 2_000)).toBeNull();
    expect(google.buildAuthUrl(s, true)).toContain("gmail.readonly");
    expect(google.buildAuthUrl(s, false)).not.toContain("gmail.readonly");
  });
});

describe("Calendar: push", () => {
  it("membuat event dengan ID deterministik, lalu memperbarui; token tidak tersimpan polos", async () => {
    const { org, integ } = await connect();
    const a = await mkActivity(org.orgId, org.owner.id);
    on(eventOk());
    expect(await google.pushActivity(integ.id, a.id)).toEqual({ action: "created" });
    const post = callsTo(/events$/, "POST")[0];
    const body = JSON.parse(post.body!);
    expect(body).toMatchObject({
      id: google.eventIdOf(a.id),
      summary: "Meeting Klien",
      extendedProperties: { private: { crmActivityId: a.id, crmOrgId: org.orgId } },
    });
    expect(new Date(body.end.dateTime).getTime() - new Date(body.start.dateTime).getTime()).toBe(
      3_600_000,
    );
    expect(await testPrisma.calendarEventLink.count()).toBe(1);
    await testPrisma.activity.update({ where: { id: a.id }, data: { status: "done" } });
    expect(await google.pushActivity(integ.id, a.id)).toEqual({ action: "updated" });
    expect(JSON.parse(callsTo(/events\/[a-v0-9]+$/, "PATCH")[0].body!).summary).toBe(
      "✓ Meeting Klien",
    );
    const row = await testPrisma.googleIntegration.findUniqueOrThrow({ where: { id: integ.id } });
    expect(row.refreshTokenEncrypted).not.toContain("refresh-1");
    expect(decryptSecret(row.refreshTokenEncrypted, `${org.orgId}:${org.owner.id}:google`)).toBe(
      "refresh-1",
    );
  });

  it("idempoten: create bentrok 409 (event sudah ada) jatuh ke update — tidak duplikat", async () => {
    const { org, integ } = await connect();
    const a = await mkActivity(org.orgId, org.owner.id);
    on((url, init) =>
      init.method === "POST" && /events$/.test(url) ? json({ error: "conflict" }, 409) : undefined,
    );
    on((url, init) =>
      init.method === "PATCH" ? json({ id: google.eventIdOf(a.id), etag: '"p"' }) : undefined,
    );
    expect(await google.pushActivity(integ.id, a.id)).toEqual({ action: "created" });
    expect(callsTo(/events\/[a-v0-9]+$/, "PATCH")).toHaveLength(1);
    expect(await testPrisma.calendarEventLink.count()).toBe(1);
  });

  it("menghapus event saat activity dibatalkan/dihapus/tanpa tenggat/pindah owner", async () => {
    const { org, integ } = await connect();
    on(eventOk());
    on((_u, init) => (init.method === "DELETE" ? new Response(null, { status: 204 }) : undefined));
    const a = await mkActivity(org.orgId, org.owner.id);
    await google.pushActivity(integ.id, a.id);
    await testPrisma.activity.update({ where: { id: a.id }, data: { status: "cancelled" } });
    expect(await google.pushActivity(integ.id, a.id)).toEqual({ action: "deleted" });
    expect(await testPrisma.calendarEventLink.count()).toBe(0);
    // dihapus dari CRM → link bertahan (tanpa FK) → event dihapus
    const b = await mkActivity(org.orgId, org.owner.id, { subject: "Task Dua", type: "task" });
    await google.pushActivity(integ.id, b.id);
    await testPrisma.activity.delete({ where: { id: b.id } });
    expect(await google.pushActivity(integ.id, b.id)).toEqual({ action: "deleted" });
    expect(await testPrisma.calendarEventLink.count()).toBe(0);
    // bukan miliknya / tipe email-note-whatsapp tidak disinkron
    const c = await mkActivity(org.orgId, null as never, { subject: "Tanpa owner" });
    expect(await google.pushActivity(integ.id, c.id)).toEqual({ action: "skipped" });
    const d = await mkActivity(org.orgId, org.owner.id, { type: "note", subject: "Catatan" });
    expect(await google.pushActivity(integ.id, d.id)).toEqual({ action: "skipped" });
    expect(callsTo(/events$/, "POST")).toHaveLength(2);
  });

  it("rate limit Google (429) → GoogleRateLimitError dan tidak ada tautan palsu; percobaan ulang berhasil", async () => {
    const { org, integ } = await connect();
    const a = await mkActivity(org.orgId, org.owner.id);
    on((url, init) =>
      init.method === "POST" && /events$/.test(url)
        ? json({}, 429, { "retry-after": "42" })
        : undefined,
    );
    await expect(google.pushActivity(integ.id, a.id)).rejects.toMatchObject({
      retryAfterSeconds: 42,
    });
    expect(await testPrisma.calendarEventLink.count()).toBe(0);
    handlers = [];
    on(eventOk());
    expect(await google.pushActivity(integ.id, a.id)).toEqual({ action: "created" });
    // 403 rateLimitExceeded juga dikenali
    handlers = [];
    on(() => json({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403));
    await testPrisma.activity.update({ where: { id: a.id }, data: { subject: "Baru" } });
    await expect(google.pushActivity(integ.id, a.id)).rejects.toBeInstanceOf(
      google.GoogleRateLimitError,
    );
  });

  it("token kedaluwarsa disegarkan sekali dan dipakai ulang; 401 memaksa refresh; invalid_grant → revoked", async () => {
    const { org, integ } = await connect({ expired: true });
    const a = await mkActivity(org.orgId, org.owner.id);
    const b = await mkActivity(org.orgId, org.owner.id, { subject: "Dua" });
    on((url) =>
      url === google.GOOGLE_TOKEN_URL
        ? json({ access_token: "access-2", expires_in: 3600 })
        : undefined,
    );
    on((url, init) => {
      if (/events$/.test(url) && init.method === "POST") {
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === "Bearer access-2"
          ? json({ id: (JSON.parse(String(init.body)) as { id: string }).id, etag: '"1"' })
          : json({}, 401);
      }
    });
    await google.pushActivity(integ.id, a.id);
    await google.pushActivity(integ.id, b.id);
    expect(callsTo(/oauth2\.googleapis\.com\/token/)).toHaveLength(1);
    // 401 di tengah jalan → segarkan paksa
    await testPrisma.googleIntegration.update({
      where: { id: integ.id },
      data: {
        accessExpiresAt: new Date(Date.now() + 3_600_000),
        accessTokenEncrypted: google.encryptTokens(
          { organizationId: org.orgId, userId: org.owner.id },
          { refresh: "refresh-1", access: "stale" },
        ).accessTokenEncrypted,
      },
    });
    const c = await mkActivity(org.orgId, org.owner.id, { subject: "Tiga" });
    await google.pushActivity(integ.id, c.id);
    expect(callsTo(/oauth2\.googleapis\.com\/token/)).toHaveLength(2);
    // refresh token dicabut
    handlers = [];
    on((url) =>
      url === google.GOOGLE_TOKEN_URL ? json({ error: "invalid_grant" }, 400) : undefined,
    );
    await testPrisma.googleIntegration.update({
      where: { id: integ.id },
      data: { accessExpiresAt: new Date(0) },
    });
    const d = await mkActivity(org.orgId, org.owner.id, { subject: "Empat" });
    await expect(google.pushActivity(integ.id, d.id)).rejects.toBeInstanceOf(
      google.GoogleAuthError,
    );
    expect(
      (await testPrisma.googleIntegration.findUniqueOrThrow({ where: { id: integ.id } })).status,
    ).toBe("revoked");
    expect(await google.pushActivity(integ.id, d.id)).toEqual({ action: "skipped" });
  });
});

describe("Calendar: pull", () => {
  async function linked() {
    const { org, integ } = await connect();
    const a = await mkActivity(org.orgId, org.owner.id);
    on(eventOk('"mine"'));
    await google.pushActivity(integ.id, a.id);
    handlers = [];
    return { org, integ, a };
  }
  const list =
    (items: unknown[], next = "tok-2") =>
    (url: string) =>
      /events\?/.test(url) ? json({ items, nextSyncToken: next }) : undefined;

  it("perubahan di Google (waktu & judul) memperbarui activity; gema perubahan sendiri (etag sama) diabaikan; syncToken disimpan & dipakai", async () => {
    const { org, integ, a } = await linked();
    const newStart = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const props = { private: { crmActivityId: a.id, crmOrgId: org.orgId } };
    on(
      list([
        {
          id: google.eventIdOf(a.id),
          etag: '"mine"',
          summary: "ECHO",
          start: { dateTime: newStart },
          updated: new Date(Date.now() + 5000).toISOString(),
          extendedProperties: props,
        },
      ]),
    );
    expect(await google.pullCalendar(integ.id)).toEqual({ changed: 0 });
    expect((await testPrisma.activity.findUniqueOrThrow({ where: { id: a.id } })).subject).toBe(
      "Meeting Klien",
    );
    handlers = [];
    on(
      list([
        {
          id: google.eventIdOf(a.id),
          etag: '"theirs"',
          summary: "✓ Meeting Diubah",
          start: { dateTime: newStart },
          updated: new Date(Date.now() + 5000).toISOString(),
          extendedProperties: props,
        },
      ]),
    );
    expect(await google.pullCalendar(integ.id)).toEqual({ changed: 1 });
    const after = await testPrisma.activity.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.subject).toBe("Meeting Diubah");
    expect(after.dueAt!.toISOString()).toBe(newStart);
    const row = await testPrisma.googleIntegration.findUniqueOrThrow({ where: { id: integ.id } });
    expect(row.calendarSyncToken).toBe("tok-2");
    handlers = [];
    on(list([], "tok-3"));
    await google.pullCalendar(integ.id);
    expect(callsTo(/events\?/).at(-1)!.url).toContain("syncToken=tok-2");
  });

  it("event dibatalkan di Google → activity dibatalkan; CRM yang lebih baru tidak ditimpa", async () => {
    const { org, integ, a } = await linked();
    const props = { private: { crmActivityId: a.id, crmOrgId: org.orgId } };
    on(
      list([
        {
          id: google.eventIdOf(a.id),
          etag: '"c"',
          status: "cancelled",
          updated: new Date(Date.now() - 60_000).toISOString(),
          extendedProperties: props,
        },
      ]),
    );
    await google.pullCalendar(integ.id); // activity.updatedAt lebih baru dari perubahan Google → dilewati
    expect((await testPrisma.activity.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "open",
    );
    handlers = [];
    on(
      list([
        {
          id: google.eventIdOf(a.id),
          etag: '"c2"',
          status: "cancelled",
          updated: new Date(Date.now() + 60_000).toISOString(),
          extendedProperties: props,
        },
      ]),
    );
    await google.pullCalendar(integ.id);
    expect((await testPrisma.activity.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "cancelled",
    );
  });

  it("event asing/tanpa properti CRM/organisasi lain diabaikan (isolasi tenant); 410 mengulang dari awal", async () => {
    const { org, integ, a } = await linked();
    const other = await makeOrg("Org Lain");
    const foreign = { private: { crmActivityId: a.id, crmOrgId: other.orgId } };
    on(
      list([
        {
          id: google.eventIdOf(a.id),
          etag: '"x"',
          summary: "DIBAJAK",
          updated: new Date(Date.now() + 9e4).toISOString(),
          extendedProperties: foreign,
        },
        {
          id: "eventluar",
          etag: '"y"',
          summary: "Rapat pribadi",
          updated: new Date().toISOString(),
        },
      ]),
    );
    expect(await google.pullCalendar(integ.id)).toEqual({ changed: 0 });
    expect((await testPrisma.activity.findUniqueOrThrow({ where: { id: a.id } })).subject).toBe(
      "Meeting Klien",
    );
    // syncToken kedaluwarsa
    await testPrisma.googleIntegration.update({
      where: { id: integ.id },
      data: { calendarSyncToken: "basi" },
    });
    handlers = [];
    on((url) => (url.includes("syncToken=basi") ? json({}, 410) : undefined));
    on(list([], "baru"));
    await google.pullCalendar(integ.id);
    expect(
      (await testPrisma.googleIntegration.findUniqueOrThrow({ where: { id: integ.id } }))
        .calendarSyncToken,
    ).toBe("baru");
    void org;
  });
});

describe("Gmail read-only", () => {
  it("mencatat email dengan contact CRM ke timeline (subjek + cuplikan saja), tidak ganda, tidak mengirim apa pun", async () => {
    const { org, integ } = await connect({ syncEmail: true });
    const contact = await testPrisma.contact.create({
      data: { organizationId: org.orgId, name: "Budi", email: "budi@klien.test" },
    });
    on((url) =>
      /messages\?/.test(url) ? json({ messages: [{ id: "m1" }, { id: "m2" }] }) : undefined,
    );
    on((url) => {
      if (url.includes("/messages/m1?"))
        return json({
          snippet: "Halo, <b>penawaran</b> sudah kami terima",
          internalDate: String(Date.now()),
          payload: {
            headers: [
              { name: "From", value: "Budi <budi@klien.test>" },
              { name: "To", value: "saya@gmail.test" },
              { name: "Subject", value: "Re: Penawaran" },
            ],
          },
        });
      if (url.includes("/messages/m2?"))
        return json({
          snippet: "promo",
          payload: {
            headers: [
              { name: "From", value: "spam@toko.test" },
              { name: "Subject", value: "Diskon" },
            ],
          },
        });
    });
    expect(await google.syncGmail(integ.id)).toEqual({ logged: 1 });
    const acts = await testPrisma.activity.findMany({ where: { type: "email" } });
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ contactId: contact.id, ownerId: org.owner.id, status: "done" });
    expect(acts[0].subject).toBe("Email masuk: Re: Penawaran");
    expect(acts[0].body).toContain("&lt;b&gt;penawaran");
    expect(await testPrisma.emailSyncLog.count()).toBe(2);
    // Kanal terpadu (plan 3.6): email contact juga menjadi percakapan email di Inbox (idempoten).
    const emailConv = await testPrisma.conversation.findFirstOrThrow({ where: { kind: "email" } });
    expect(emailConv).toMatchObject({ handle: "budi@klien.test", contactId: contact.id });
    expect(await testPrisma.message.count({ where: { externalId: "gmail:m1" } })).toBe(1);
    expect(await google.syncGmail(integ.id)).toEqual({ logged: 0 });
    expect(await testPrisma.message.count({ where: { conversationId: emailConv.id } })).toBe(1);
    expect(await testPrisma.activity.count({ where: { type: "email" } })).toBe(1);
    expect(calls.every((c) => c.method === "GET" || /oauth2/.test(c.url))).toBe(true);
    expect(callsTo(/gmail\.googleapis\.com/).every((c) => !/send|modify|trash/.test(c.url))).toBe(
      true,
    );
  });

  it("tidak aktif bila syncEmail mati; contact organisasi lain tidak ikut tercocokkan", async () => {
    const { org, integ } = await connect({ syncEmail: false });
    expect(await google.syncGmail(integ.id)).toEqual({ logged: 0 });
    expect(callsTo(/gmail/)).toHaveLength(0);
    await testPrisma.googleIntegration.update({
      where: { id: integ.id },
      data: { syncEmail: true },
    });
    const other = await makeOrg("Org Lain");
    await testPrisma.contact.create({
      data: { organizationId: other.orgId, name: "Orang Lain", email: "x@klien.test" },
    });
    on((url) => (/messages\?/.test(url) ? json({ messages: [{ id: "z1" }] }) : undefined));
    on((url) =>
      url.includes("/messages/z1?")
        ? json({
            snippet: "s",
            payload: {
              headers: [
                { name: "From", value: "x@klien.test" },
                { name: "Subject", value: "S" },
              ],
            },
          })
        : undefined,
    );
    expect(await google.syncGmail(integ.id)).toEqual({ logged: 0 });
    void org;
  });
});

describe("Aksi pengguna & antrean", () => {
  it("membuat/mengubah/menghapus activity mengantre sinkron hanya untuk pemilik yang terhubung", async () => {
    const { org } = await connect();
    actAs(org.owner);
    const r = await activityActions.createActivity({
      type: "meeting",
      subject: "Demo produk",
      dueLocal: "2030-01-01T10:00",
    });
    const id = (r as { data: { id: string } }).data.id;
    const q = getQueue(QUEUES.calendar);
    expect((await q.getJobCounts()).waiting).toBe(1);
    await activityActions.setActivityStatus({ id, status: "done" });
    await activityActions.deleteActivity({ id });
    expect((await q.getJobCounts()).waiting).toBe(3);
    const o2 = await makeOrg("Tanpa Google");
    actAs(o2.owner);
    await activityActions.createActivity({
      type: "task",
      subject: "Task tanpa google",
      dueLocal: "2030-01-01",
    });
    expect((await q.getJobCounts()).waiting).toBe(3);
  });

  it("opsi: email butuh izin Gmail; putuskan menghapus data & mencabut token; sync manual dibatasi", async () => {
    const { org, integ } = await connect({ scopes: `openid email ${google.SCOPE_CALENDAR}` });
    actAs(org.owner);
    expect(
      await googleActions.updateGoogleOptions({ syncCalendar: true, syncEmail: true }),
    ).toMatchObject({ ok: false });
    expect(
      await googleActions.updateGoogleOptions({ syncCalendar: false, syncEmail: false }),
    ).toMatchObject({ ok: true });
    on((url) => (/events\?/.test(url) ? json({ items: [], nextSyncToken: "t" }) : undefined));
    on((url) => (url.includes("/revoke") ? json({}) : undefined));
    await googleActions.updateGoogleOptions({ syncCalendar: true, syncEmail: false });
    for (let i = 0; i < 6; i++)
      expect(await googleActions.syncGoogleNow({})).toMatchObject({ ok: true });
    expect(await googleActions.syncGoogleNow({})).toMatchObject({ ok: false });
    expect(await googleActions.disconnectGoogle({})).toMatchObject({ ok: true });
    expect(callsTo(/revoke/)).toHaveLength(1);
    expect(await testPrisma.googleIntegration.count()).toBe(0);
    void integ;
    void getTenantContext;
  });

  it("integrasi pengguna lain/organisasi lain tidak dapat diubah", async () => {
    const a = await connect();
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(await googleActions.disconnectGoogle({})).toMatchObject({ ok: false });
    expect(
      await googleActions.updateGoogleOptions({ syncCalendar: false, syncEmail: false }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.googleIntegration.count()).toBe(1);
    void a;
  });
});
