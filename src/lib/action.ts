import { headers } from "next/headers";
import { z } from "zod";
import { getTenantContext, type TenantContext } from "@/lib/context";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { reportError } from "@/lib/error-tracking";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ActionContext = TenantContext & { ip: string | null; userAgent: string | null };

/**
 * Pembungkus Server Action privat: autentikasi + tenant context + validasi Zod di server +
 * pemetaan error seragam. Handler hanya berjalan bila session & keanggotaan valid.
 * Izin spesifik diperiksa di dalam handler lewat `ctx.ability` / `assertCan` (plan 1.3).
 */
export function tenantAction<S extends z.ZodType, T>(
  schema: S,
  handler: (ctx: ActionContext, input: z.output<S>) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const ctx = await getTenantContext();
      if (!ctx) throw UnauthorizedError();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".");
          fieldErrors[key] ??= issue.message;
        }
        return { ok: false, error: "Input tidak valid", fieldErrors };
      }
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const data = await handler(
        { ...ctx, ip, userAgent: h.get("user-agent") },
        parsed.data as z.output<S>,
      );
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      reportError(error, { scope: "tenantAction" });
      return { ok: false, error: "Terjadi kesalahan pada server" };
    }
  };
}

export { ForbiddenError };
