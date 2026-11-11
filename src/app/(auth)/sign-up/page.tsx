import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Daftar" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
