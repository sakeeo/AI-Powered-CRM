import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Model yang memiliki kolom `organizationId` (tenant-scoped).
 * WAJIB diperbarui setiap menambah model bisnis; tests/unit/tenant-models.test.ts
 * memastikan daftar ini sinkron dengan prisma/schema.prisma.
 */
export const TENANT_MODELS = new Set<string>([
  "Deal",
  "PipelineStage",
  "Pipeline",
  "Lead",
  "LeadSource",
  "ContactCompany",
  "Contact",
  "Company",
  "AiCallLog",
  "TenantConnector",
  "Member",
  "Invitation",
  "Team",
  "TeamMember",
  "AuditLog",
  "InboundWebhook",
  "WebhookDelivery",
  "DealStageHistory",
  "Activity",
  "Notification",
  "NotificationPreference",
  "ProductCategory",
  "Product",
  "DealProduct",
  "QuotationSettings",
  "Quotation",
  "QuotationItem",
  "CustomerSegment",
  "CustomerSegmentMember",
  "Feedback",
  "Tag",
  "Taggable",
  "CustomFieldDefinition",
  "SavedView",
  "AutomationRule",
  "AutomationRun",
  "Conversation",
  "Message",
  "OutboundWebhook",
  "OutboundDelivery",
  "GoogleIntegration",
  "CalendarEventLink",
  "EmailSyncLog",
  "SavedReport",
  "QuotationVersion",
  "ActivityTemplate",
  "RecommendationFeedback",
  "InsightAlert",
]);

const WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

export class TenantScopeError extends Error {}

type Args = Record<string, unknown> | undefined;

function assertSameTenant(value: unknown, organizationId: string, where: string) {
  if (value !== undefined && value !== organizationId) {
    throw new TenantScopeError(
      `organizationId pada ${where} tidak boleh berbeda dari tenant aktif`,
    );
  }
}

function scopeData(data: unknown, organizationId: string, where: string): unknown {
  if (Array.isArray(data)) return data.map((d) => scopeData(d, organizationId, where));
  const obj = (data ?? {}) as Record<string, unknown>;
  assertSameTenant(obj.organizationId, organizationId, where);
  return { ...obj, organizationId };
}

/**
 * Menyisipkan `organizationId` ke args operasi Prisma. Fungsi murni agar mudah diuji.
 * - create*: set organizationId pada data
 * - read/update/delete*: AND `organizationId` ke where
 * - upsert: scope where + create
 * - menolak organizationId yang berbeda dari tenant aktif
 */
export function applyTenantScope(operation: string, args: Args, organizationId: string): Args {
  if (!organizationId) throw new TenantScopeError("organizationId wajib diisi");
  const a: Record<string, unknown> = { ...(args ?? {}) };

  if (CREATE_OPS.has(operation)) {
    a.data = scopeData(a.data, organizationId, "data");
    return a;
  }
  if (WHERE_OPS.has(operation)) {
    const where = (a.where ?? {}) as Record<string, unknown>;
    assertSameTenant(where.organizationId, organizationId, "where");
    a.where = { ...where, organizationId };
    if (operation === "upsert") a.create = scopeData(a.create, organizationId, "create");
    if (a.data && typeof a.data === "object" && !Array.isArray(a.data)) {
      assertSameTenant((a.data as Record<string, unknown>).organizationId, organizationId, "data");
    }
    if (operation === "upsert" && a.update) {
      assertSameTenant(
        (a.update as Record<string, unknown>).organizationId,
        organizationId,
        "update",
      );
    }
  }
  return a;
}

/**
 * Prisma client yang otomatis tenant-scoped. Gunakan SELALU di kode module server;
 * jangan memakai `prisma` mentah untuk model bisnis. Tenant berasal dari session
 * terautentikasi (plan 1.2/1.3), bukan dari input client.
 */
export function forTenant(prisma: PrismaClient, organizationId: string) {
  if (!organizationId) throw new TenantScopeError("organizationId wajib diisi");
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          return query(applyTenantScope(operation, args as Args, organizationId) as typeof args);
        },
      },
    },
  });
}
