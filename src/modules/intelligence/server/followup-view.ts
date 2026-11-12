import type { TenantContext } from "@/lib/context";
import type { FollowUpView } from "@/modules/intelligence/components/followup-card";
import type { FollowUpSubject } from "@/modules/intelligence/schemas";
import { getFollowUpRecommendation } from "@/modules/intelligence/server/followup";

/** Rekomendasi dalam bentuk yang aman dikirim ke Client Component (tanggal sebagai ISO). */
export async function getFollowUpView(
  ctx: TenantContext,
  s: FollowUpSubject,
): Promise<FollowUpView> {
  const r = await getFollowUpRecommendation(ctx, s);
  return {
    basis: r.basis,
    channel: r.channel,
    suggestedAt: r.suggestedAt.toISOString(),
    rationale: r.rationale,
    draft: r.draft,
  };
}
