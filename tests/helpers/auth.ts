import { auth } from "@/lib/auth";
import { current } from "./current-user";

let seq = 0;
const ORIGIN = "http://localhost:3000";

function cookieOf(res: Response) {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Daftarkan pengguna lewat Better Auth dan kembalikan cookie session-nya. */
export async function createUser(name: string, email = `u${++seq}-${Date.now()}@example.com`) {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": `10.1.${seq % 250}.${Math.floor(Math.random() * 250)}`,
      },
      body: JSON.stringify({ name, email, password: "password-12345" }),
    }),
  );
  if (!res.ok) throw new Error(`sign-up gagal: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { user: { id: string } };
  return { id: body.user.id, email, name, cookie: cookieOf(res) };
}

export function actAs(user: { cookie: string }) {
  current.cookie = user.cookie;
}

export function headersFor(user: { cookie: string }) {
  return new Headers({ cookie: user.cookie, origin: ORIGIN });
}
