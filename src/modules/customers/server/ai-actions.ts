"use server";

import { tenantAction } from "@/lib/action";
import { runAi } from "@/lib/ai";
import { partySchema } from "@/modules/customers/schemas";
import { aiBriefingBullets } from "@/modules/customers/server/ai";
import { getCustomer360 } from "@/modules/customers/server/queries";

/** Safe AI Customer 360 Briefing: hanya draf cheat-sheet; tidak menulis ke database bisnis. */
export const aiCustomerBriefing = tenantAction(partySchema, async (ctx, { type, id }) => {
  const c = await getCustomer360(ctx, type, id); // izin + scope; 404 bila bukan customer
  return {
    bullets: await runAi(ctx, "customer_briefing", ({ model }) => aiBriefingBullets(model, c)),
  };
});
