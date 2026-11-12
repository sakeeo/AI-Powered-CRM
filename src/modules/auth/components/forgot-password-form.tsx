"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/shared/auth-card";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  authErrorMessage,
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/modules/auth/schemas";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit({ email }: ForgotPasswordInput) {
    setError(undefined);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    if (error) return setError(authErrorMessage(error));
    setSent(true);
  }

  return (
    <AuthCard
      title="Lupa password"
      description="Kami akan mengirim tautan untuk mengatur ulang password."
      footer={
        <Link href="/login" className="text-loud font-medium hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      {sent ? (
        <p
          role="status"
          className="bg-tone-green-soft text-tone-green-ink text-label rounded-md px-3 py-2"
        >
          Jika email terdaftar, tautan reset password telah dikirim. Periksa kotak masuk Anda.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {error && (
            <p
              role="alert"
              className="bg-tone-red-soft text-tone-red-ink text-label rounded-md px-3 py-2"
            >
              {error}
            </p>
          )}
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Mengirim…" : "Kirim tautan reset"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
