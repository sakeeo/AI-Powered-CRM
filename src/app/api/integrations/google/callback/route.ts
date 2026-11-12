import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/context";
import {
  SCOPE_CALENDAR,
  SCOPE_GMAIL,
  emailFromIdToken,
  encryptTokens,
  exchangeCode,
  googleConfigured,
  verifyState,
} from "@/lib/google";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

/**
 * Callback OAuth Google. State harus sah (HMAC, belum kedaluwarsa) DAN cocok dengan pengguna/organisasi
 * pada session saat ini — mencegah penautan akun Google ke pengguna lain (login CSRF).
 */
export async function GET(req: NextRequest) {
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/settings/integrations?${q}`, req.url));
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url));
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back("google=denied");
  const state = verifyState(sp.get("state") ?? "");
  const code = sp.get("code");
  if (!googleConfigured() || !state || !code) return back("google=invalid");
  if (state.u !== ctx.userId || state.o !== ctx.organizationId) return back("google=invalid");

  try {
    const t = await exchangeCode(code);
    const scopes = t.scope ?? "";
    if (!scopes.includes(SCOPE_CALENDAR)) return back("google=scope");
    const email = emailFromIdToken(t.id_token) ?? "akun Google";
    const existing = await ctx.db.googleIntegration.findFirst({ where: { userId: ctx.userId } });
    const refresh = t.refresh_token;
    if (!refresh && !existing) return back("google=norefresh");
    const hasGmail = scopes.includes(SCOPE_GMAIL);
    const tokens = refresh
      ? encryptTokens(
          { organizationId: ctx.organizationId, userId: ctx.userId },
          { refresh, access: t.access_token },
        )
      : null;
    const base = {
      googleEmail: email,
      scopes,
      syncEmail: hasGmail && state.e,
      status: "active",
      lastError: null,
      accessExpiresAt: new Date(Date.now() + t.expires_in * 1000),
      calendarSyncToken: null,
      ...(tokens ?? {}),
    };
    if (existing) {
      await ctx.db.googleIntegration.update({ where: { id: existing.id }, data: base as never });
    } else {
      await ctx.db.googleIntegration.create({
        data: { ...base, userId: ctx.userId, syncCalendar: true } as never,
      });
    }
    await writeAudit(
      { ...ctx, ip: null, userAgent: null },
      {
        action: "google.connected",
        entityType: "Integration",
        entityId: ctx.userId,
        after: { email, gmail: hasGmail },
      },
    );
    return back("google=connected");
  } catch (err) {
    logger.error({ err }, "OAuth Google gagal");
    return back("google=failed");
  }
}
