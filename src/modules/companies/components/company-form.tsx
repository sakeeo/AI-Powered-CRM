"use client";

import { CustomizationSection } from "@/modules/customization/components/customization-section";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OwnerOption } from "@/modules/contacts/components/contact-form";
import { companySchema, type CompanyData, type CompanyInput } from "@/modules/contacts/schemas";
import { createCompany, updateCompany } from "@/modules/companies/server/actions";

export function CompanyForm({
  companyId,
  defaults,
  owners,
  canAssignOwner,
  onDone,
}: {
  companyId?: string;
  defaults?: Partial<CompanyInput>;
  owners: OwnerOption[];
  canAssignOwner: boolean;
  onDone: (id?: string) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompanyInput, unknown, CompanyData>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", ...defaults },
  });

  async function onSubmit(values: CompanyData) {
    const res = companyId
      ? await updateCompany({ ...values, id: companyId })
      : await createCompany(values);
    if (!res.ok) {
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {}))
        setError(k as keyof CompanyInput, { message: msg });
      toast.error(res.error);
      return;
    }
    toast.success(companyId ? "Company diperbarui" : "Company dibuat");
    onDone(companyId ?? (res.data as { id: string } | undefined)?.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="name" label="Nama perusahaan" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="industry" label="Industri" error={errors.industry?.message}>
          <Input id="industry" {...register("industry")} />
        </FormField>
        <FormField id="website" label="Website" error={errors.website?.message}>
          <Input id="website" {...register("website")} />
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </FormField>
        <FormField id="phone" label="Telepon" error={errors.phone?.message}>
          <Input id="phone" type="tel" {...register("phone")} />
        </FormField>
      </div>
      <FormField id="address" label="Alamat" error={errors.address?.message}>
        <Input id="address" {...register("address")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="city" label="Kota">
          <Input id="city" {...register("city")} />
        </FormField>
        <FormField id="country" label="Negara">
          <Input id="country" {...register("country")} />
        </FormField>
      </div>
      {canAssignOwner && (
        <FormField id="ownerId" label="Pemilik">
          <Controller
            control={control}
            name="ownerId"
            render={({ field }) => (
              <Select
                value={(field.value as string | undefined) ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="ownerId" className="w-full">
                  <SelectValue placeholder="Saya" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.userId} value={o.userId}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}
      <FormField id="notes" label="Catatan internal" error={errors.notes?.message}>
        <Textarea id="notes" rows={4} {...register("notes")} />
      </FormField>
      <CustomizationSection entity="company" control={control} />
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
