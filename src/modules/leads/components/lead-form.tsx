"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_CODES } from "@/lib/money";
import { URGENCIES, URGENCY_LABEL } from "@/modules/leads/constants";
import { leadSchema, type LeadData, type LeadInput } from "@/modules/leads/schemas";
import { createLead, updateLead } from "@/modules/leads/server/actions";

export type SourceOption = { id: string; name: string };
export type OwnerOption = { userId: string; name: string };

export function LeadForm({
  leadId,
  defaults,
  sources,
  owners,
  canAssignOwner,
  defaultCurrency,
  onDone,
}: {
  leadId?: string;
  defaults?: Partial<LeadInput>;
  sources: SourceOption[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  defaultCurrency: string;
  onDone: (id?: string) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeadInput, unknown, LeadData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", currency: defaultCurrency as LeadInput["currency"], ...defaults },
  });

  async function onSubmit(values: LeadData) {
    const res = leadId ? await updateLead({ ...values, id: leadId }) : await createLead(values);
    if (!res.ok) {
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {}))
        setError(k as keyof LeadInput, { message: msg });
      toast.error(res.error);
      return;
    }
    toast.success(leadId ? "Lead diperbarui" : "Lead dibuat");
    onDone(leadId ?? (res.data as { id: string } | undefined)?.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="name" label="Nama lead" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </FormField>
        <FormField id="phone" label="Telepon" error={errors.phone?.message}>
          <Input id="phone" type="tel" {...register("phone")} />
        </FormField>
      </div>
      <FormField id="companyName" label="Perusahaan" error={errors.companyName?.message}>
        <Input id="companyName" {...register("companyName")} />
      </FormField>
      <FormField id="needs" label="Kebutuhan" error={errors.needs?.message}>
        <Textarea id="needs" rows={3} {...register("needs")} />
      </FormField>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <FormField id="budget" label="Budget" error={errors.budget?.message}>
          <Input id="budget" inputMode="decimal" {...register("budget")} />
        </FormField>
        <FormField id="currency" label="Mata uang">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                id="currency"
                value={field.value as string}
                onChange={field.onChange}
                options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
              />
            )}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="urgency" label="Urgensi">
          <Controller
            control={control}
            name="urgency"
            render={({ field }) => (
              <SelectField
                id="urgency"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="Belum ditentukan"
                options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
              />
            )}
          />
        </FormField>
        <FormField id="sourceId" label="Sumber">
          <Controller
            control={control}
            name="sourceId"
            render={({ field }) => (
              <SelectField
                id="sourceId"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="Tidak diketahui"
                options={sources.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          />
        </FormField>
      </div>
      {canAssignOwner && (
        <FormField id="ownerId" label="Ditugaskan ke">
          <Controller
            control={control}
            name="ownerId"
            render={({ field }) => (
              <SelectField
                id="ownerId"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="Belum ditugaskan"
                options={owners.map((o) => ({ value: o.userId, label: o.name }))}
              />
            )}
          />
        </FormField>
      )}
      <FormField id="notes" label="Catatan" error={errors.notes?.message}>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
