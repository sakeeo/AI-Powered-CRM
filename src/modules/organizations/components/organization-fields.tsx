"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCIES,
  DATE_FORMATS,
  type OrganizationProfileInput,
} from "@/modules/organizations/schemas";
import { timezoneOptions } from "@/modules/organizations/components/timezone-options";

/** Field profil organisasi dipakai di onboarding & Settings. */
export function OrganizationFields({
  form,
  withDateFormat,
  disabled,
}: {
  form: UseFormReturn<OrganizationProfileInput>;
  withDateFormat?: boolean;
  disabled?: boolean;
}) {
  const { register, control, formState } = form;
  const errors = formState.errors;
  const zones = timezoneOptions();
  return (
    <>
      <FormField id="name" label="Nama organisasi" error={errors.name?.message}>
        <Input id="name" disabled={disabled} aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField id="timezone" label="Zona waktu" error={errors.timezone?.message}>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <FormField
        id="defaultCurrency"
        label="Mata uang default"
        error={errors.defaultCurrency?.message}
      >
        <Controller
          control={control}
          name="defaultCurrency"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id="defaultCurrency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      {withDateFormat && (
        <FormField id="dateFormat" label="Format tanggal" error={errors.dateFormat?.message}>
          <Controller
            control={control}
            name="dateFormat"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="dateFormat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}
    </>
  );
}
