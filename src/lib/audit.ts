import type { TenantContext } from "@/lib/context";

const SENSITIVE_KEY = /(secret|password|passwd|token|api_?key|authorization|cipher|credential)/i;

/** Hapus nilai rahasia dari objek sebelum disimpan ke audit log (key/secret tidak boleh tercatat). */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSecrets) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactSecrets(v),
      ]),
    ) as T;
  }
  return value;
}

export type AuditInput = {
  action: string; // mis. "member.role_changed"
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

type AuditCtx = Pick<TenantContext, "db"> & {
  /** null = tindakan sistem/eksternal (mis. webhook masuk). */
  userId: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** Catat perubahan penting: siapa, apa, entitas, before/after, waktu (otomatis), IP. */
export async function writeAudit(ctx: AuditCtx, input: AuditInput) {
  // organizationId disisipkan oleh tenant-scoped client; cast karena extension menambahkannya.
  await ctx.db.auditLog.create({
    data: {
      actorId: ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? undefined : (redactSecrets(input.before) as never),
      after: input.after === undefined ? undefined : (redactSecrets(input.after) as never),
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    } as never,
  });
}
