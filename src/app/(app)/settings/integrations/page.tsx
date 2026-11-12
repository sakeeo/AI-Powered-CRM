import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { googleConfigured, SCOPE_GMAIL } from "@/lib/google";
import { GoogleCard } from "@/modules/integrations/components/google-card";

export const metadata: Metadata = { title: "Integrasi Saya" };

export default async function Page() {
  const ctx = await requireTenant();
  const row = await ctx.db.googleIntegration.findFirst({
    where: { userId: ctx.userId },
    select: {
      googleEmail: true,
      syncCalendar: true,
      syncEmail: true,
      scopes: true,
      status: true,
      lastError: true,
      lastSyncAt: true,
    },
  });
  return (
    <GoogleCard
      view={{
        configured: googleConfigured(),
        integration: row && {
          googleEmail: row.googleEmail,
          syncCalendar: row.syncCalendar,
          syncEmail: row.syncEmail,
          hasGmailScope: row.scopes.includes(SCOPE_GMAIL),
          status: row.status,
          lastError: row.lastError,
          lastSyncAt: row.lastSyncAt,
        },
      }}
    />
  );
}
