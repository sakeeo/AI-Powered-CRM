import { createHmac, timingSafeEqual } from "node:crypto";
import type { GoogleIntegration } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";

/**
 * Integrasi Google per pengguna (Calendar dua arah + Gmail read-only), memakai REST API dengan `fetch`.
 * Token dienkripsi (AES-GCM, AAD org+user). Access token disegarkan otomatis; `invalid_grant` menandai
 * koneksi `revoked`. Semua akses data CRM lewat forTenant(organisasi integrasi).
 */
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const CAL_API = "https://www.googleapis.com/calendar/v3";
export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export const SCOPE_CALENDAR = "https://www.googleapis.com/auth/calendar.events";
export const SCOPE_GMAIL = "https://www.googleapis.com/auth/gmail.readonly";

export const googleConfigured = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const redirectUri = () => `${env.BETTER_AUTH_URL}/api/integrations/google/callback`;

export class GoogleRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Google membatasi laju permintaan (coba lagi ${retryAfterSeconds} dtk)`);
  }
}
export class GoogleAuthError extends Error {}

const aadOf = (i: { organizationId: string; userId: string }) =>
  `${i.organizationId}:${i.userId}:google`;

// ------------------------------------------------------------------ OAuth state
type StatePayload = { u: string; o: string; e: boolean; x: number; n: string };

/** State OAuth bertanda tangan HMAC (anti CSRF/pemalsuan): memuat user, org, opsi email, kedaluwarsa. */
export function signState(p: Omit<StatePayload, "x" | "n">, now = Date.now()) {
  const payload: StatePayload = {
    ...p,
    x: now + 10 * 60_000,
    n: Math.random().toString(36).slice(2),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", env.BETTER_AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState(state: string, now = Date.now()): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", env.BETTER_AUTH_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as StatePayload;
    return p.x > now ? p : null;
  } catch {
    return null;
  }
}

export function buildAuthUrl(state: string, withEmail: boolean) {
  const scopes = ["openid", "email", SCOPE_CALENDAR, ...(withEmail ? [SCOPE_GMAIL] : [])];
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${q}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new GoogleAuthError("Akses Google dicabut");
    throw new Error(`Token Google gagal (${json.error ?? res.status})`);
  }
  return json;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });

/** Email akun Google dari id_token (payload saja; token diterima langsung dari Google lewat TLS). */
export function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ Akses API
async function loadIntegration(id: string): Promise<GoogleIntegration | null> {
  return prisma.googleIntegration.findUnique({ where: { id } });
}

/** Access token valid (disegarkan bila < 60 dtk dari kedaluwarsa). */
export async function getAccessToken(integ: GoogleIntegration, now = new Date()): Promise<string> {
  const aad = aadOf(integ);
  if (
    integ.accessTokenEncrypted &&
    integ.accessExpiresAt &&
    integ.accessExpiresAt.getTime() > now.getTime() + 60_000
  )
    return decryptSecret(integ.accessTokenEncrypted, aad);
  try {
    const t = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(integ.refreshTokenEncrypted, aad),
    });
    await prisma.googleIntegration.update({
      where: { id: integ.id },
      data: {
        accessTokenEncrypted: encryptSecret(t.access_token, aad),
        accessExpiresAt: new Date(now.getTime() + t.expires_in * 1000),
        status: "active",
        lastError: null,
      },
    });
    return t.access_token;
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await prisma.googleIntegration.update({
        where: { id: integ.id },
        data: { status: "revoked", lastError: "Akses Google dicabut. Hubungkan ulang." },
      });
    }
    throw e;
  }
}

export function encryptTokens(
  i: { organizationId: string; userId: string },
  t: { refresh: string; access: string },
) {
  const aad = aadOf(i);
  return {
    refreshTokenEncrypted: encryptSecret(t.refresh, aad),
    accessTokenEncrypted: encryptSecret(t.access, aad),
  };
}

/** Panggil Google API dengan Bearer; satu kali coba ulang setelah 401; 429/403-rate → GoogleRateLimitError. */
export async function googleApi(
  integ: GoogleIntegration,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let current = integ;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(current);
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 && attempt === 0) {
      // Token ditolak: paksa segarkan.
      await prisma.googleIntegration.update({
        where: { id: integ.id },
        data: { accessExpiresAt: new Date(0) },
      });
      current = (await loadIntegration(integ.id)) ?? current;
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      throw new GoogleRateLimitError(Number(res.headers.get("retry-after")) || 30);
    }
    if (res.status === 403) {
      const j = (await res
        .clone()
        .json()
        .catch(() => ({}))) as { error?: { errors?: { reason?: string }[] } };
      const reason = j.error?.errors?.[0]?.reason ?? "";
      if (/rateLimit|quotaExceeded/i.test(reason)) throw new GoogleRateLimitError(60);
    }
    return res;
  }
  throw new GoogleAuthError("Token Google ditolak");
}

const markError = (id: string, message: string) =>
  prisma.googleIntegration
    .update({ where: { id }, data: { lastError: message.slice(0, 200), status: "error" } })
    .catch(() => undefined);

// ------------------------------------------------------------------ Calendar
export const eventIdOf = (activityId: string) => activityId.replaceAll("-", "").toLowerCase();

const DURATION_MIN: Record<string, number> = { meeting: 60, call: 30 };

type CalEvent = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

function buildEvent(
  a: { id: string; type: string; subject: string; status: string; dueAt: Date },
  orgId: string,
) {
  const mins = DURATION_MIN[a.type] ?? 30;
  return {
    id: eventIdOf(a.id),
    summary: `${a.status === "done" ? "✓ " : ""}${a.subject}`,
    description: `Dibuat dari CRM (${a.type}). Buka: ${env.BETTER_AUTH_URL}/activities`,
    start: { dateTime: a.dueAt.toISOString() },
    end: { dateTime: new Date(a.dueAt.getTime() + mins * 60_000).toISOString() },
    extendedProperties: { private: { crmActivityId: a.id, crmOrgId: orgId } },
  };
}

/**
 * Dorong satu activity ke Google Calendar milik pengguna integrasi: buat/perbarui, atau hapus bila
 * activity hilang/dibatalkan/tanpa tenggat/bukan miliknya. ID event deterministik → idempoten
 * (jika create sukses tetapi DB gagal, percobaan ulang jatuh ke update, bukan duplikat).
 */
export async function pushActivity(integrationId: string, activityId: string) {
  const integ = await loadIntegration(integrationId);
  if (!integ || integ.status === "revoked" || !integ.syncCalendar)
    return { action: "skipped" as const };
  const db = forTenant(prisma, integ.organizationId);
  const [activity, link] = await Promise.all([
    db.activity.findFirst({ where: { id: activityId } }),
    db.calendarEventLink.findFirst({ where: { integrationId, activityId } }),
  ]);
  const eventUrl = `${CAL_API}/calendars/primary/events/${eventIdOf(activityId)}`;

  const shouldExist =
    !!activity &&
    !!activity.dueAt &&
    activity.status !== "cancelled" &&
    activity.ownerId === integ.userId &&
    activity.type !== "whatsapp" &&
    activity.type !== "email" &&
    activity.type !== "note";
  if (!shouldExist) {
    if (!link) return { action: "skipped" as const };
    const res = await googleApi(integ, eventUrl, { method: "DELETE" });
    if (!res.ok && res.status !== 404 && res.status !== 410)
      throw new Error(`Gagal menghapus event Google (${res.status})`);
    await db.calendarEventLink.deleteMany({ where: { id: link.id } });
    return { action: "deleted" as const };
  }

  const body = JSON.stringify(
    buildEvent(
      {
        id: activity.id,
        type: activity.type,
        subject: activity.subject,
        status: activity.status,
        dueAt: activity.dueAt!,
      },
      integ.organizationId,
    ),
  );
  const headers = { "content-type": "application/json" };
  let res = link
    ? await googleApi(integ, eventUrl, { method: "PATCH", headers, body })
    : await googleApi(integ, `${CAL_API}/calendars/primary/events`, {
        method: "POST",
        headers,
        body,
      });
  // create bentrok (event sudah ada) atau event terhapus di Google → pulihkan lewat jalur lain.
  if (!link && res.status === 409)
    res = await googleApi(integ, eventUrl, { method: "PATCH", headers, body });
  if (link && (res.status === 404 || res.status === 410))
    res = await googleApi(integ, `${CAL_API}/calendars/primary/events`, {
      method: "POST",
      headers,
      body,
    });
  if (!res.ok) {
    const msg = `Gagal menyimpan event Google (${res.status})`;
    if (res.status >= 400 && res.status < 500) await markError(integ.id, msg);
    throw new Error(msg);
  }
  const ev = (await res.json()) as CalEvent;
  const data = {
    externalId: ev.id ?? eventIdOf(activityId),
    etag: ev.etag ?? null,
    lastPushedAt: new Date(),
  };
  if (link) await db.calendarEventLink.update({ where: { id: link.id }, data });
  else await db.calendarEventLink.create({ data: { integrationId, activityId, ...data } as never });
  return { action: link ? ("updated" as const) : ("created" as const) };
}

/**
 * Tarik perubahan dari Google (inkremental via syncToken). Hanya event yang berasal dari CRM
 * (extendedProperties.crmActivityId + crmOrgId cocok) yang memengaruhi activity:
 * dibatalkan → activity dibatalkan; waktu/judul berubah → diperbarui bila perubahan Google lebih baru.
 * "Gema" perubahan kita sendiri dikenali lewat ETag dan diabaikan.
 */
export async function pullCalendar(integrationId: string, now = new Date()) {
  const integ = await loadIntegration(integrationId);
  if (!integ || integ.status === "revoked" || !integ.syncCalendar) return { changed: 0 };
  const db = forTenant(prisma, integ.organizationId);
  let syncToken = integ.calendarSyncToken;
  let changed = 0;

  for (let restart = 0; restart < 2; restart++) {
    let pageToken: string | undefined;
    let next: string | undefined;
    let expired = false;
    do {
      const q = new URLSearchParams({ showDeleted: "true", maxResults: "250" });
      if (syncToken) q.set("syncToken", syncToken);
      else q.set("timeMin", new Date(now.getTime() - 7 * 86_400_000).toISOString());
      if (pageToken) q.set("pageToken", pageToken);
      const res = await googleApi(integ, `${CAL_API}/calendars/primary/events?${q}`);
      if (res.status === 410) {
        syncToken = null;
        expired = true;
        break;
      }
      if (!res.ok) throw new Error(`Gagal membaca kalender Google (${res.status})`);
      const page = (await res.json()) as {
        items?: CalEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      for (const ev of page.items ?? []) {
        const props = ev.extendedProperties?.private;
        if (!props?.crmActivityId || props.crmOrgId !== integ.organizationId) continue;
        const link = await db.calendarEventLink.findFirst({
          where: { integrationId, externalId: ev.id },
        });
        if (!link || link.activityId !== props.crmActivityId) continue;
        if (link.etag && link.etag === ev.etag) continue; // gema push kita
        const activity = await db.activity.findFirst({ where: { id: link.activityId } });
        if (!activity) continue;
        const googleUpdated = ev.updated ? new Date(ev.updated) : now;
        if (activity.updatedAt > googleUpdated) continue; // CRM lebih baru
        const data: Record<string, unknown> = {};
        if (ev.status === "cancelled") {
          if (activity.status === "open") data.status = "cancelled";
        } else {
          const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
          if (start && Math.abs(start.getTime() - (activity.dueAt?.getTime() ?? 0)) > 60_000)
            data.dueAt = start;
          const subject = (ev.summary ?? "").replace(/^✓ /, "").trim();
          if (subject && subject !== activity.subject) data.subject = subject.slice(0, 160);
        }
        if (Object.keys(data).length) {
          await db.activity.update({ where: { id: activity.id }, data });
          changed++;
        }
        await db.calendarEventLink.update({
          where: { id: link.id },
          data: { etag: ev.etag ?? null },
        });
      }
      pageToken = page.nextPageToken;
      next = page.nextSyncToken ?? next;
    } while (pageToken);
    if (expired) continue;
    await prisma.googleIntegration.update({
      where: { id: integ.id },
      data: {
        calendarSyncToken: next ?? syncToken,
        lastSyncAt: now,
        status: "active",
        lastError: null,
      },
    });
    return { changed };
  }
  return { changed };
}

// ------------------------------------------------------------------ Gmail (read-only)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const addressesOf = (h: string) =>
  [...h.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0].toLowerCase());

/**
 * Catat email yang melibatkan contact CRM ke timeline (read-only: hanya subjek + cuplikan, tidak
 * pernah menyimpan isi lengkap/lampiran dan tidak mengirim email). Email tanpa contact cocok diabaikan
 * (dicatat sebagai sudah diproses agar tidak diambil ulang).
 */
export async function syncGmail(integrationId: string, now = new Date()) {
  const integ = await loadIntegration(integrationId);
  if (!integ || integ.status === "revoked" || !integ.syncEmail) return { logged: 0 };
  const db = forTenant(prisma, integ.organizationId);
  const since = integ.emailSyncedAt ?? new Date(now.getTime() - 3 * 86_400_000);
  const q = new URLSearchParams({
    q: `after:${Math.floor(since.getTime() / 1000)}`,
    maxResults: "50",
  });
  const list = await googleApi(integ, `${GMAIL_API}/users/me/messages?${q}`);
  if (!list.ok) throw new Error(`Gagal membaca Gmail (${list.status})`);
  const ids = ((await list.json()) as { messages?: { id: string }[] }).messages ?? [];
  const known = new Set(
    (
      await db.emailSyncLog.findMany({
        where: { integrationId, messageId: { in: ids.map((m) => m.id) } },
        select: { messageId: true },
      })
    ).map((k) => k.messageId),
  );
  const self = integ.googleEmail.toLowerCase();
  let logged = 0;
  for (const { id } of ids) {
    if (known.has(id)) continue;
    const res = await googleApi(
      integ,
      `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    if (!res.ok) {
      if (res.status === 404) continue;
      throw new Error(`Gagal membaca pesan Gmail (${res.status})`);
    }
    const msg = (await res.json()) as {
      snippet?: string;
      internalDate?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const h = (n: string) =>
      msg.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const people = [
      ...new Set([...addressesOf(h("From")), ...addressesOf(h("To")), ...addressesOf(h("Cc"))]),
    ].filter((a) => a !== self);
    const contact = people.length
      ? await db.contact.findFirst({
          where: { email: { in: people, mode: "insensitive" }, deletedAt: null },
          orderBy: { createdAt: "asc" },
        })
      : null;
    let activityId: string | null = null;
    if (contact) {
      const when = msg.internalDate ? new Date(Number(msg.internalDate)) : now;
      const out = addressesOf(h("From")).includes(self);
      const a = await db.activity.create({
        data: {
          type: "email",
          subject: `${out ? "Email terkirim" : "Email masuk"}: ${(h("Subject") || "(tanpa subjek)").slice(0, 120)}`,
          body: `<p>${esc((msg.snippet ?? "").slice(0, 300))}</p>`,
          status: "done",
          completedAt: when,
          ownerId: integ.userId,
          contactId: contact.id,
        } as never,
      });
      activityId = a.id;
      logged++;
    }
    try {
      await db.emailSyncLog.create({ data: { integrationId, messageId: id, activityId } as never });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  await prisma.googleIntegration.update({
    where: { id: integ.id },
    data: { emailSyncedAt: now, lastSyncAt: now, status: "active", lastError: null },
  });
  return { logged };
}

// ------------------------------------------------------------------ Orkestrasi worker
export type CalendarJob = { integrationId: string; activityId: string };

/** Pemindaian berkala semua koneksi aktif: tarik kalender, sinkron email, dan backfill push. */
export async function syncAllGoogle(now = new Date()) {
  const integrations = await prisma.googleIntegration.findMany({
    where: { status: { in: ["active", "error"] } },
    select: { id: true, organizationId: true, userId: true, syncCalendar: true, syncEmail: true },
  });
  let ok = 0;
  for (const i of integrations) {
    try {
      if (i.syncCalendar) {
        // Backfill: activity berjadwal milik pengguna yang belum punya tautan.
        const db = forTenant(prisma, i.organizationId);
        const linked = await db.calendarEventLink.findMany({
          where: { integrationId: i.id },
          select: { activityId: true },
        });
        const todo = await db.activity.findMany({
          where: {
            ownerId: i.userId,
            type: { in: ["task", "call", "meeting"] },
            status: "open",
            dueAt: {
              gte: new Date(now.getTime() - 86_400_000),
              lte: new Date(now.getTime() + 90 * 86_400_000),
            },
            id: { notIn: linked.map((l) => l.activityId) },
          },
          select: { id: true },
          take: 50,
        });
        for (const a of todo) await pushActivity(i.id, a.id);
        await pullCalendar(i.id, now);
      }
      if (i.syncEmail) await syncGmail(i.id, now);
      ok++;
    } catch (err) {
      if (err instanceof GoogleRateLimitError) {
        logger.warn({ integrationId: i.id }, "Google rate limit; dilewati hingga siklus berikut");
        continue;
      }
      logger.error({ err, integrationId: i.id }, "Sinkronisasi Google gagal");
      await markError(i.id, (err as Error).message);
    }
  }
  return { integrations: integrations.length, ok };
}
