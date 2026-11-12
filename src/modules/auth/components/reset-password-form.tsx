"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthCard } from "@/components/shared/auth-card";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  authErrorMessage,
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/modules/auth/schemas";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const invalid = !token || params.get("error") === "INVALID_TOKEN";
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit({ password }: ResetPasswordInput) {
    setError(undefined);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    if (error) return setError(authErrorMessage(error));
    toast.success("Password diubah. Silakan masuk dengan password baru.");
    router.replace("/login");
  }

  return (
    <AuthCard
      title="Atur ulang password"
      description="Masukkan password baru Anda."
      footer={
        <Link href="/login" className="text-loud font-medium hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      {invalid ? (
        <p
          role="alert"
          className="bg-tone-red-soft text-tone-red-ink text-label rounded-md px-3 py-2"
        >
          Tautan reset tidak valid atau sudah kedaluwarsa.{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Minta tautan baru
          </Link>
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
          <FormField
            id="password"
            label="Password baru"
            hint="Minimal 8 karakter."
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
          </FormField>
          <FormField
            id="confirmPassword"
            label="Konfirmasi password"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan…" : "Simpan password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
