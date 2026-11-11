"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { tenantAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { encryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { rotateWebhookSchema, toggleWebhookSchema } from "@/modules/webhooks/schemas";

const aad = (organizationId: string) => `${organizationId}:webhook_inbound`;
const newSecret = () => `whsec_${randomBytes(32).toString("base64url")}`;
const hint = (s: string) => `whsec_...${s.slice(-4)}`;

/**
 * Buat webhook (pertama kali) atau rotasi secret. Secret asli dikembalikan SEKALI di respons ini
 * dan tidak dapat dibaca lagi; yang tersimpan hanya ciphertext + petunjuk bermasker.
 */
export const generateWebhook = tenantAction(rotateWebhookSchema, async (ctx) => {
  assertCan(ctx, "update", "Connector");
  const secret = newSecret();
  const secretEncrypted = encryptSecret(secret, aad(ctx.organizationId));
  const existing = await ctx.db.inboundWebhook.findFirst();
  let publicId: string;
  if (existing) {
    publicId = existing.publicId;
    await ctx.db.inboundWebhook.update({
      where: { id: existing.id },
      data: { secretEncrypted, maskedHint: hint(secret), updatedBy: ctx.userId },
    });
  } else {
    publicId = randomBytes(18).toString("base64url");
    await ctx.db.inboundWebhook.create({
      data: { publicId, secretEncrypted, maskedHint: hint(secret), createdBy: ctx.userId } as never,
    });
  }
  await writeAudit(ctx, {
    action: existing ? "webhook.secret_rotated" : "webhook.created",
    entityType: "Connector",
    entityId: "webhook_inbound",
    after: { maskedHint: hint(secret) },
  });
  revalidatePath("/settings/connectors");
  return { publicId, secret };
});

export const toggleWebhook = tenantAction(toggleWebhookSchema, async (ctx, { isActive }) => {
  assertCan(ctx, "update", "Connector");
  const existing = await ctx.db.inboundWebhook.findFirst();
  if (!existing) throw new AppError("Webhook belum dibuat", 404, "not_found");
  await ctx.db.inboundWebhook.update({
    where: { id: existing.id },
    data: { isActive, updatedBy: ctx.userId },
  });
  await writeAudit(ctx, {
    action: isActive ? "webhook.activated" : "webhook.deactivated",
    entityType: "Connector",
    entityId: "webhook_inbound",
  });
  revalidatePath("/settings/connectors");
});
