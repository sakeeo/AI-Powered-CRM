"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/shared/auth-card";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, signUpSchema, type SignUpInput } from "@/modules/auth/schemas";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  async function onSubmit({ name, email, password }: SignUpInput) {
    setError(undefined);
    const { data, error } = await authClient.signUp.email({ name, email, password });
    if (error) return setError(authErrorMessage(error));
    // Bila verifikasi email diwajibkan, server tidak membuat session.
    if (!data?.token)
      return setNotice("Akun dibuat. Periksa email Anda untuk verifikasi, lalu masuk.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Buat akun"
      description="Mulai kelola penjualan Anda."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      {notice ? (
        <p
          role="status"
          className="bg-tone-green-soft text-tone-green-ink text-label rounded-md px-3 py-2"
        >
          {notice}
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
          <FormField id="name" label="Nama lengkap" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
          </FormField>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </FormField>
          <FormField
            id="password"
            label="Password"
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
            {isSubmitting ? "Memproses…" : "Daftar"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
