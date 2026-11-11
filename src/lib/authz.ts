import { abilityToWhere, asSubject, type Action, type SubjectName } from "@/lib/abilities";
import type { TenantContext } from "@/lib/context";
import { ForbiddenError } from "@/lib/errors";

type Ctx = Pick<TenantContext, "ability">;

/**
 * Guard izin server-side. Tanpa `record`: cek izin umum. Dengan `record`: kondisi
 * kepemilikan/tim ikut dievaluasi (mis. Sales Rep hanya boleh mengubah lead miliknya).
 * Melempar ForbiddenError (403) bila ditolak.
 */
export function assertCan(ctx: Ctx, action: Action, type: SubjectName, record?: object) {
  const allowed = record
    ? ctx.ability.can(action, asSubject(type, record))
    : ctx.ability.can(action, type);
  if (!allowed) throw ForbiddenError();
}

/** Filter Prisma `where` untuk query daftar sesuai izin; lempar 403 bila tidak punya akses. */
export function scopeWhere(ctx: Ctx, action: Action, type: SubjectName): Record<string, unknown> {
  const where = abilityToWhere(ctx.ability, action, type);
  if (where === null) throw ForbiddenError();
  return where;
}

/**
 * Pemilik record baru. Sales Rep selalu menjadi pemilik data yang ia buat (agar tetap bisa
 * mengelolanya); peran lain boleh menetapkan pemilik lain (harus anggota aktif — divalidasi pemanggil).
 */
export function resolveOwner(ctx: { role: string; userId: string }, requested?: string | null) {
  if (ctx.role === "sales_rep") return ctx.userId;
  return requested ?? ctx.userId;
}
