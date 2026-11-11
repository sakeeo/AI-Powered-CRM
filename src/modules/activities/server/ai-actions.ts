"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { runAi } from "@/lib/ai";
import { assertCan, scopeWhere } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { optionalUuid } from "@/lib/schema-helpers";
import { dateInTz } from "@/lib/timezone";
import { assertLinks } from "@/modules/activities/server/links";
import {
  extractActionItems,
  ghostwriteFollowUp,
  MAX_NOTES_LENGTH,
  summarizeNotes,
  toPlainText,
} from "@/modules/activities/server/ai";
import { getOrganization } from "@/modules/organizations/server/queries";

const notesSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Tulis minimal 10 karakter")
    .max(MAX_NOTES_LENGTH, `Maksimal ${MAX_NOTES_LENGTH} karakter`),
});

/**
 * Semua aksi AI di file ini HANYA mengembalikan draf. Tidak ada penulisan ke tabel bisnis dan tidak ada
 * pengiriman pesan; user harus menekan Catat/Buat task/Salin sendiri (human-in-the-loop).
 */
export const aiSummarizeNotes = tenantAction(notesSchema, async (ctx, { text }) => {
  assertCan(ctx, "create", "Activity");
  return {
    summary: await runAi(ctx, "meeting_summary", ({ model }) => summarizeNotes(model, text)),
  };
});

export const aiExtractActionItems = tenantAction(notesSchema, async (ctx, { text }) => {
  assertCan(ctx, "create", "Activity");
  const { timezone } = await getOrganization(ctx);
  const today = dateInTz(new Date(), timezone);
  return {
    items: await runAi(ctx, "action_items", ({ model }) => extractActionItems(model, text, today)),
  };
});

const ghostSchema = z.object({
  leadId: optionalUuid,
  contactId: optionalUuid,
  dealId: optionalUuid,
});

export const aiGhostwriteFollowUp = tenantAction(ghostSchema, async (ctx, link) => {
  assertCan(ctx, "view", "Activity");
  const key = (["leadId", "contactId", "dealId"] as const).find((k) => link[k]);
  if (!key) throw new AppError("Pilih lead, contact, atau deal");
  await assertLinks(ctx, link);
  const rows = await ctx.db.activity.findMany({
    where: { AND: [{ [key]: link[key] }, scopeWhere(ctx, "view", "Activity")] } as never,
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { type: true, subject: true, body: true },
  });
  const name =
    key === "leadId"
      ? (await ctx.db.lead.findFirst({ where: { id: link.leadId } }))?.name
      : key === "contactId"
        ? (await ctx.db.contact.findFirst({ where: { id: link.contactId } }))?.name
        : (await ctx.db.deal.findFirst({ where: { id: link.dealId } }))?.title;
  const history = rows.map((r) => ({
    type: r.type,
    subject: r.subject,
    text: toPlainText(r.body),
  }));
  return {
    options: await runAi(ctx, "followup_ghostwriter", ({ model }) =>
      ghostwriteFollowUp(model, name ?? "pelanggan", history),
    ),
  };
});
