"use client";

import { CustomizationSection } from "@/modules/customization/components/customization-section";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { FormActions } from "@/components/shared/form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_CODES } from "@/lib/money";
import { dealSchema, type DealData, type DealInput } from "@/modules/deals/schemas";
import { createDeal, updateDeal } from "@/modules/deals/server/actions";

export type Opt = { id: string; name: string };
export type OwnerOpt = { userId: string; name: string };

export function DealForm({
  dealId,
  defaults,
  contacts,
  companies,
  stages,
  owners,
  canAssignOwner,
  defaultCurrency,
  onDone,
}: {
  dealId?: string;
  defaults?: Partial<DealInput>;
  contacts: Opt[];
  companies: Opt[];
  stages: Opt[];
  owners: OwnerOpt[];
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
  } = useForm<DealInput, unknown, DealData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      currency: defaultCurrency as DealInput["currency"],
      stageId: stages[0]?.id,
      ...defaults,
    },
  });

  async function onSubmit(values: DealData) {
    const res = dealId ? await updateDeal({ ...values, id: dealId }) : await createDeal(values);
    if (!res.ok) {
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {}))
        setError(k as keyof DealInput, { message: msg });
      toast.error(res.error);
      return;
    }
    toast.success(dealId ? "Deal diperbarui" : "Deal dibuat");
    onDone(dealId ?? (res.data as { id: string } | undefined)?.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="title" label="Judul deal" error={errors.title?.message}>
        <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contactId" label="Contact" error={errors.contactId?.message}>
          <Controller
            control={control}
            name="contactId"
            render={({ field }) => (
              <SelectField
                id="contactId"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="—"
                options={contacts.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
          />
        </FormField>
        <FormField id="companyId" label="Company" error={errors.companyId?.message}>
          <Controller
            control={control}
            name="companyId"
            render={({ field }) => (
              <SelectField
                id="companyId"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="—"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <FormField id="value" label="Nilai deal" error={errors.value?.message}>
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <NumberInput
                id="value"
                decimals={2}
                value={String(field.value ?? "")}
                onValueChange={field.onChange}
              />
            )}
          />
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
        {!dealId && (
          <FormField id="stageId" label="Stage awal">
            <Controller
              control={control}
              name="stageId"
              render={({ field }) => (
                <SelectField
                  id="stageId"
                  value={field.value as string | undefined}
                  onChange={field.onChange}
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                />
              )}
            />
          </FormField>
        )}
        <FormField
          id="expectedCloseDate"
          label="Perkiraan closing"
          error={errors.expectedCloseDate?.message}
        >
          <Input id="expectedCloseDate" type="date" {...register("expectedCloseDate")} />
        </FormField>
        <FormField
          id="probability"
          label="Probabilitas (%)"
          hint="Kosongkan untuk mengikuti stage."
          error={errors.probability?.message}
        >
          <Input id="probability" type="number" min={0} max={100} {...register("probability")} />
        </FormField>
      </div>
      {canAssignOwner && (
        <FormField id="ownerId" label="PIC">
          <Controller
            control={control}
            name="ownerId"
            render={({ field }) => (
              <SelectField
                id="ownerId"
                value={field.value as string | undefined}
                onChange={field.onChange}
                noneLabel="Saya"
                options={owners.map((o) => ({ value: o.userId, label: o.name }))}
              />
            )}
          />
        </FormField>
      )}
      <FormField id="notes" label="Catatan" error={errors.notes?.message}>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </FormField>
      <CustomizationSection entity="deal" control={control} />
      <FormActions>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan…" : "Simpan"}
        </Button>
      </FormActions>
    </form>
  );
}
