import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
