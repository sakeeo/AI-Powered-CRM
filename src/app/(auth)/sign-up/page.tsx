import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { signUpAccess } from "@/modules/organizations/server/setup";

export const metadata: Metadata = { title: "Daftar" };

async function Content({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const next = pickParam(sp, "next");
  // Pendaftaran hanya terbuka di setup awal (belum ada Owner) atau lewat undangan yang berlaku.
  const { open, invitedEmail } = await signUpAccess(next);
  if (!open) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return <SignUpForm defaultEmail={invitedEmail ?? undefined} />;
}

export default function Page(props: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={props.searchParams as Promise<SearchParams>} />
    </Suspense>
  );
}
