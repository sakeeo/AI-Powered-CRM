import type { Prisma } from "@/generated/prisma/client";
import { assertCan, scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import type { ListParams } from "@/lib/list-params";

export async function listFeedback(
  ctx: TenantContext,
  params: ListParams,
  filters: { type?: string; status?: string } = {},
) {
  assertCan(ctx, "view", "Feedback");
  const q = params.q;
  const where: Prisma.FeedbackWhereInput = {
    AND: [
      scopeWhere(ctx, "view", "Feedback") as Prisma.FeedbackWhereInput,
      ...(filters.type ? [{ type: filters.type }] : []),
      ...(filters.status ? [{ status: filters.status }] : []),
      ...(q
        ? [
            {
              OR: [
                { subject: { contains: q, mode: "insensitive" as const } },
                { body: { contains: q, mode: "insensitive" as const } },
                { contact: { name: { contains: q, mode: "insensitive" as const } } },
                { company: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          ]
        : []),
    ],
  };
  const [total, rows] = await Promise.all([
    ctx.db.feedback.count({ where }),
    ctx.db.feedback.findMany({
      where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: {
        contact: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { total, page: params.page, pageSize: params.pageSize, rows };
}
