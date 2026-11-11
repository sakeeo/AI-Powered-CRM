import type { Metadata } from "next";
import { requireTenant } from "@/lib/context";
import { MembersPanel } from "@/modules/organizations/components/members-panel";
import { TeamsPanel } from "@/modules/organizations/components/teams-panel";
import {
  listMembers,
  listPendingInvitations,
  listTeams,
} from "@/modules/organizations/server/queries";

export const metadata: Metadata = { title: "Users & Teams" };

export default async function Page() {
  const ctx = await requireTenant();
  const [members, invitations, teams] = await Promise.all([
    listMembers(ctx),
    ctx.ability.can("create", "Member") ? listPendingInvitations(ctx) : Promise.resolve([]),
    listTeams(ctx),
  ]);
  return (
    <div className="space-y-4">
      <MembersPanel
        members={members}
        invitations={invitations}
        currentUserId={ctx.userId}
        actorRole={ctx.role}
      />
      <TeamsPanel
        teams={teams}
        people={members.filter((m) => m.active).map((m) => ({ userId: m.userId, name: m.name }))}
      />
    </div>
  );
}
