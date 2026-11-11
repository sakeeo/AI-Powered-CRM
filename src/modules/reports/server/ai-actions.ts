"use server";

import { z } from "zod";
import { tenantAction } from "@/lib/action";
import { runAi } from "@/lib/ai";
import { assertCan } from "@/lib/authz";
import { suggestLostCategory } from "@/modules/reports/server/lost-category";

/**
 * Safe AI Lost Reason Categorizer: hanya MENGUSULKAN kategori dari teks. Tidak menyimpan apa pun;
 * kategori final ditetapkan user lewat markDealLost / setLostCategory.
 */
export const aiSuggestLostCategory = tenantAction(
  z.object({ text: z.string().trim().min(3, "Tulis alasan dulu").max(500) }),
  async (ctx, { text }) => {
    assertCan(ctx, "update", "Deal");
    return {
      category: await runAi(ctx, "lost_category", ({ model }) => suggestLostCategory(model, text)),
    };
  },
);
