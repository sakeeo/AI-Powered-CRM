import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { requireSession } from "@/lib/session";
import { OnboardingForm } from "@/modules/organizations/components/onboarding-form";

export const metadata: Metadata = { title: "Buat organisasi" };

async function Content({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireSession();
  const { new: isNew } = await searchParams;
  // Sudah punya organisasi dan bukan permintaan membuat yang baru → ke dashboard.
  if (!isNew && (await getTenantContext())) redirect("/dashboard");
  return <OnboardingForm defaultTimezone="Asia/Jakarta" />;
}

export default function Page(props: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={props.searchParams as Promise<{ new?: string }>} />
    </Suspense>
  );
}
