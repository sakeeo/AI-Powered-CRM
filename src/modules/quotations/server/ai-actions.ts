"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { runAi } from "@/lib/ai";
import { assertCan } from "@/lib/authz";
import { NotFoundError } from "@/lib/errors";
import { checkNarrative, draftNarrative } from "@/modules/quotations/server/narrative";

const schema = z.object({
  quotationId: z.uuid(),
  guidance: z.string().trim().max(300, "Maksimal 300 karakter").optional(),
});

/**
 * HANYA mengembalikan draf narasi (teks) beserta peringatan hasil pemeriksaan deterministik. Tidak ada
 * penulisan ke database dan tidak ada pengiriman: pengguna meninjau/mengedit lalu menyimpan sendiri
 * lewat form quotation (human-in-the-loop). Angka uang tidak pernah berasal dari LLM.
 */
export const aiDraftQuotationNarrative = tenantAction(
  schema,
  async (ctx, { quotationId, guidance }) => {
    const q = await ctx.db.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        contact: { select: { name: true } },
        company: { select: { name: true } },
      },
    });
    if (!q) throw NotFoundError("Quotation");
    assertCan(ctx, "update", "Quotation", q);
    const quantities = q.items.map((i) => Number(i.quantity));
    const draft = await runAi(ctx, "quotation_narrative", ({ model }) =>
      draftNarrative(model, {
        title: q.title,
        customer: q.company?.name ?? q.contact?.name ?? "Pelanggan",
        validUntil: q.validUntil.toISOString().slice(0, 10),
        items: q.items.map((i) => ({
          name: i.name,
          description: i.description,
          quantity: Number(i.quantity),
        })),
        guidance,
      }),
    );
    const check = checkNarrative(draft, {
      quantities,
      validUntil: q.validUntil.toISOString().slice(0, 10),
    });
    return { draft, warnings: check.warnings };
  },
);
