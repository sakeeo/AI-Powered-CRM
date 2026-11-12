"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoUploader } from "@/modules/organizations/components/logo-uploader";
import { OrganizationFields } from "@/modules/organizations/components/organization-fields";
import {
  organizationProfileSchema,
  type OrganizationProfileInput,
} from "@/modules/organizations/schemas";
import { updateOrganizationProfile } from "@/modules/organizations/server/actions";

export function OrganizationProfileForm({
  defaults,
  canEdit,
  logoUrl,
}: {
  defaults: OrganizationProfileInput;
  canEdit: boolean;
  logoUrl: string | null;
}) {
  const form = useForm<OrganizationProfileInput>({
    resolver: zodResolver(organizationProfileSchema),
    defaultValues: defaults,
  });
  const {
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = form;

  async function onSubmit(values: OrganizationProfileInput) {
    const res = await updateOrganizationProfile(values);
    if (!res.ok) return toast.error(res.error);
    toast.success("Profil organisasi disimpan");
    form.reset(values);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader className="block">
        <CardTitle>Profil organisasi</CardTitle>
        <CardDescription>
          Zona waktu menentukan batas hari untuk aktivitas dan laporan.
          {!canEdit && " Hanya Owner/Admin yang dapat mengubah."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LogoUploader name={defaults.name} logoUrl={logoUrl} canEdit={canEdit} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <OrganizationFields form={form} withDateFormat disabled={!canEdit} />
          {canEdit && (
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
