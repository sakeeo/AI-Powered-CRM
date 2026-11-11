import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { parseListParams, pickParam, type SearchParams } from "@/lib/list-params";
import { listCompanyOptions, listContactOptions } from "@/modules/contacts/server/queries";
import { FeedbackTable } from "@/modules/feedback/components/feedback-table";
import { FEEDBACK_SORTS } from "@/modules/feedback/schemas";
import { listFeedback } from "@/modules/feedback/server/queries";

export const metadata: Metadata = { title: "Customer Feedback" };

export default async function Page(props: PageProps<"/feedback">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Feedback")) return <Forbidden what="feedback" />;
  const sp = (await props.searchParams) as SearchParams;
  const params = parseListParams(sp, FEEDBACK_SORTS, "createdAt");
  const [data, contacts, companies] = await Promise.all([
    listFeedback(ctx, params, { type: pickParam(sp, "type"), status: pickParam(sp, "status") }),
    listContactOptions(ctx),
    listCompanyOptions(ctx),
  ]);
  return (
    <FeedbackTable
      table={{
        data: data.rows,
        total: data.total,
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        dir: params.dir,
        q: params.q,
      }}
      contacts={contacts}
      companies={companies}
    />
  );
}
