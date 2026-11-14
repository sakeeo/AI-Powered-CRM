import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, testPrisma } from "../helpers/db";

const sent: { to: string; text: string }[] = [];
vi.mock("@/lib/mailer", () => ({
  sendMail: async (m: { to: string; text: string }) => void sent.push(m),
}));
// next/headers hanya ada di konteks request Next.js; plugin nextCookies mengabaikannya di test.
vi.mock("next/headers", () => ({
  cookies: async () => ({ set() {} }),
  headers: async () => new Headers(),
}));

const { auth } = await import("@/lib/auth");
const { redis } = await import("@/lib/redis");
const { proxy } = await import("@/proxy");

const ORIGIN = "http://localhost:3000";
const ip = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; ip?: string } = {},
) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": init.ip ?? ip(),
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    }),
  );
}

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

const USER = { name: "Budi Santoso", email: "budi@example.com", password: "rahasia-12345" };

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("alur autentikasi", () => {
  it("register → login → session → logout", async () => {
    const up = await call("/sign-up/email", { body: USER });
    expect(up.status).toBe(200);

    // password tersimpan sebagai hash (bukan plaintext)
    const account = await testPrisma.account.findFirstOrThrow({
      where: { providerId: "credential" },
    });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(USER.password);

    const bad = await call("/sign-in/email", {
      body: { email: USER.email, password: "salah-salah" },
    });
    expect(bad.status).toBe(401);

    const login = await call("/sign-in/email", {
      body: { email: USER.email, password: USER.password },
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const cookie = cookieOf(login);

    const session = await (await call("/get-session", { cookie })).json();
    expect(session.user.email).toBe(USER.email);

    const out = await call("/sign-out", { method: "POST", body: {}, cookie });
    expect(out.status).toBe(200);
    const after = await call("/get-session", { cookie });
    expect(await after.json()).toBeNull();
  });

  it("email duplikat ditolak", async () => {
    await call("/sign-up/email", { body: USER });
    const dup = await call("/sign-up/email", { body: USER });
    expect(dup.status).toBeGreaterThanOrEqual(400);
  });

  it("reset password: email terkirim, token mengganti password, token sekali pakai", async () => {
    await call("/sign-up/email", { body: USER });
    const req = await call("/request-password-reset", {
      body: { email: USER.email, redirectTo: "/reset-password" },
    });
    expect(req.status).toBe(200);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].to).toBe(USER.email);
    const token = sent[0].text.match(/reset-password\/([^?\s]+)/)?.[1];
    expect(token).toBeTruthy();

    const reset = await call("/reset-password", {
      body: { newPassword: "password-baru-99", token },
    });
    expect(reset.status).toBe(200);

    const old = await call("/sign-in/email", {
      body: { email: USER.email, password: USER.password },
    });
    expect(old.status).toBe(401);
    const fresh = await call("/sign-in/email", {
      body: { email: USER.email, password: "password-baru-99" },
    });
    expect(fresh.status).toBe(200);

    const reuse = await call("/reset-password", {
      body: { newPassword: "lain-lagi-12345", token },
    });
    expect(reuse.status).toBeGreaterThanOrEqual(400);
  });

  it("reset password untuk email tidak terdaftar tidak membocorkan keberadaan akun", async () => {
    const res = await call("/request-password-reset", {
      body: { email: "tidak-ada@example.com", redirectTo: "/reset-password" },
    });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });
});

describe("aturan pendaftaran (PUBLIC_SIGNUP=false)", () => {
  it("terbuka sebelum ada Owner; setelah itu ditutup kecuali untuk undangan pending", async () => {
    const prev = process.env.PUBLIC_SIGNUP;
    process.env.PUBLIC_SIGNUP = "false";
    try {
      // Belum ada Owner → pendaftaran pertama terbuka.
      const first = await call("/sign-up/email", { body: USER });
      expect(first.status).toBe(200);
      const owner = await testPrisma.user.findUniqueOrThrow({ where: { email: USER.email } });
      const org = await testPrisma.organization.create({
        data: { name: "Org Uji", slug: `org-uji-${randomUUID().slice(0, 8)}` },
      });
      await testPrisma.member.create({
        data: { organizationId: org.id, userId: owner.id, role: "owner" },
      });

      // Owner sudah ada → pendaftaran tanpa undangan ditolak.
      const closed = await call("/sign-up/email", {
        body: { name: "Asing", email: "asing@example.com", password: "rahasia-12345" },
        ip: "10.9.0.2",
      });
      expect(closed.status).toBe(403);
      expect(await closed.json()).toMatchObject({ code: "SIGNUP_CLOSED" });
      expect(await testPrisma.user.count({ where: { email: "asing@example.com" } })).toBe(0);

      // Calon anggota dengan undangan pending tetap bisa mendaftar.
      await testPrisma.invitation.create({
        data: {
          organizationId: org.id,
          email: "diundang@example.com",
          role: "sales_rep",
          status: "pending",
          inviterId: owner.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const invited = await call("/sign-up/email", {
        body: { name: "Diundang", email: "diundang@example.com", password: "rahasia-12345" },
        ip: "10.9.0.3",
      });
      expect(invited.status).toBe(200);
    } finally {
      process.env.PUBLIC_SIGNUP = prev;
    }
  });
});

describe("rate limiting", () => {
  it("login dibatasi 5x/menit per IP", async () => {
    const same = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await call("/sign-in/email", {
        body: { email: USER.email, password: "salah-salah" },
        ip: same,
      });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it("request reset password dibatasi 3x/10 menit per IP", async () => {
    const same = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await call("/request-password-reset", {
        body: { email: `x${i}-${randomUUID()}@example.com`, redirectTo: "/reset-password" },
        ip: same,
      });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe("proteksi route (proxy)", () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });

  it("tanpa session, route privat dialihkan ke /login dengan next", () => {
    const res = proxy(req("/leads?page=2"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/leads?page=2");
  });

  it("halaman auth bisa diakses tanpa session", () => {
    expect(proxy(req("/login")).headers.get("location")).toBeNull();
    expect(proxy(req("/reset-password")).headers.get("location")).toBeNull();
  });

  it("dengan cookie session, route privat lolos dan /login dialihkan ke dashboard", () => {
    const cookie = "better-auth.session_token=abc.def";
    expect(proxy(req("/leads", cookie)).headers.get("location")).toBeNull();
    expect(new URL(proxy(req("/login", cookie)).headers.get("location")!).pathname).toBe(
      "/dashboard",
    );
  });
});
