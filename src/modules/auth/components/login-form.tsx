"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/shared/auth-card";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  authErrorMessage,
  loginSchema,
  safeNextPath,
  type LoginInput,
} from "@/modules/auth/schemas";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(undefined);
    const { error } = await authClient.signIn.email(values);
    if (error) return setError(authErrorMessage(error));
    router.replace(safeNextPath(params.get("next")));
    router.refresh();
  }

  return (
    <AuthCard
      title="Masuk"
      description="Masuk ke workspace CRM Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/sign-up" className="text-loud font-medium hover:underline">
            Daftar
          </Link>
        </>
      }
    >
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
        <FormField id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </FormField>
        <div className="text-right">
          <Link href="/forgot-password" className="text-loud text-xs hover:underline">
            Lupa password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Memproses…" : "Masuk"}
        </Button>
      </form>
    </AuthCard>
  );
}
