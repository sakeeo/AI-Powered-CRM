"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
import { OrganizationFields } from "@/modules/organizations/components/organization-fields";
import {
  organizationProfileSchema,
  type OrganizationProfileInput,
} from "@/modules/organizations/schemas";
import { createOrganizationAction } from "@/modules/organizations/server/actions";

export function OnboardingForm({ defaultTimezone }: { defaultTimezone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const form = useForm<OrganizationProfileInput>({
    resolver: zodResolver(organizationProfileSchema),
    defaultValues: {
      name: "",
      timezone: defaultTimezone,
      defaultCurrency: "IDR",
      dateFormat: "dd/MM/yyyy",
    },
  });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  async function onSubmit(values: OrganizationProfileInput) {
    setError(undefined);
    const res = await createOrganizationAction(values);
    if (!res.ok) return setError(res.error);
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Buat organisasi"
      description="Anda akan menjadi Owner. Pengaturan ini bisa diubah nanti."
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
        <OrganizationFields form={form} />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Membuat…" : "Buat organisasi"}
        </Button>
      </form>
    </AuthCard>
  );
}
