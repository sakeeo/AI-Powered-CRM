import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Atur ulang password" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
