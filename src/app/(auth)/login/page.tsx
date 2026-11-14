import type { Metadata } from "next";
import { Suspense } from "react";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { LoginForm } from "@/modules/auth/components/login-form";
import { signUpAccess } from "@/modules/organizations/server/setup";

export const metadata: Metadata = { title: "Masuk" };

async function Content({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // Tautan "Daftar" hanya tampil di setup awal (belum ada Owner) atau saat membuka undangan.
  const { open } = await signUpAccess(pickParam(sp, "next"));
  return <LoginForm allowSignUp={open} />;
}

export default function Page(props: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={props.searchParams as Promise<SearchParams>} />
    </Suspense>
  );
}
