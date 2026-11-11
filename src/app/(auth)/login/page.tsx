import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
