import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { AcceptInvitation } from "@/modules/organizations/components/accept-invitation";

export const metadata: Metadata = { title: "Undangan organisasi" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const invitation = await auth.api
    .getInvitation({ headers: await headers(), query: { id } })
    .catch(() => null);
  return (
    <AcceptInvitation
      invitationId={id}
      email={session.user.email}
      invitation={
        invitation
          ? {
              organizationName: invitation.organizationName,
              role: invitation.role,
              inviterEmail: invitation.inviterEmail,
            }
          : null
      }
    />
  );
}

export default function Page(props: PageProps<"/accept-invitation/[id]">) {
  return (
    <Suspense fallback={null}>
      <Content params={props.params} />
    </Suspense>
  );
}
