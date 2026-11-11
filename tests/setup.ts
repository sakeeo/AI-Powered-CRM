import "dotenv/config";

// Semua test memakai database terpisah `crm_test` (siapkan dengan `npm run db:test:setup`).
const url = new URL(process.env.DATABASE_URL ?? "postgresql://x:x@localhost:5434/crm_dev");
url.pathname = "/crm_test";
process.env.DATABASE_URL = url.toString();

// Mock API Next.js yang hanya ada di konteks request; berlaku untuk semua test.
import { vi } from "vitest";

vi.mock("next/headers", async () => {
  const { current } = await import("./helpers/current-user");
  return {
    headers: async () =>
      new Headers({
        cookie: current.cookie,
        "x-forwarded-for": current.ip,
        "user-agent": "vitest",
      }),
    cookies: async () => ({ set() {}, get: () => undefined }),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  updateTag: () => {},
}));
vi.mock("@/lib/mailer", async () => {
  const { mails } = await import("./helpers/mails");
  return {
    sendMail: async (m: { to: string; text: string; subject: string }) => void mails.push(m),
  };
});
