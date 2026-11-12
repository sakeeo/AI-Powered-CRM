import type { Metadata } from "next";
import { Forbidden } from "@/components/shared/forbidden";
import { requireTenant } from "@/lib/context";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { listOwnerOptions } from "@/modules/organizations/server/queries";
import { CHANNEL_KINDS } from "@/modules/omnichannel/constants";
import { Inbox } from "@/modules/whatsapp/components/inbox";
import {
  getConversation,
  listConversations,
  type InboxFilter,
} from "@/modules/whatsapp/server/queries";

export const metadata: Metadata = { title: "Inbox" };

export default async function Page(props: PageProps<"/inbox">) {
  const ctx = await requireTenant();
  if (!ctx.ability.can("view", "Conversation")) return <Forbidden what="inbox" />;
  const sp = (await props.searchParams) as SearchParams;
  const filter = (
    ["mine", "unassigned"].includes(pickParam(sp, "filter") ?? "") ? pickParam(sp, "filter") : "all"
  ) as InboxFilter;
  const status = pickParam(sp, "status") === "closed" ? "closed" : "open";
  const kindParam = pickParam(sp, "kind");
  const kind = (CHANNEL_KINDS as readonly string[]).includes(kindParam ?? "")
    ? kindParam
    : undefined;
  const selectedId = pickParam(sp, "c");
  const [conversations, owners, selected] = await Promise.all([
    listConversations(ctx, { filter, status, kind }),
    listOwnerOptions(ctx),
    selectedId ? getConversation(ctx, selectedId).catch(() => null) : null,
  ]);
  return (
    <Inbox
      conversations={conversations}
      selected={selected}
      filter={filter}
      status={status}
      kind={kind}
      owners={owners}
      me={ctx.userId}
      role={ctx.role}
      canLead={ctx.ability.can("create", "Lead")}
    />
  );
}
