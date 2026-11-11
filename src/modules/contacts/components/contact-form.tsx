"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema, type ContactData, type ContactInput } from "@/modules/contacts/schemas";
import { createContact, updateContact } from "@/modules/contacts/server/actions";

export type Option = { id: string; name: string };
export type OwnerOption = { userId: string; name: string };

export function ContactForm({
  contactId,
  defaults,
  companies,
  owners,
  canAssignOwner,
  onDone,
}: {
  contactId?: string;
  defaults?: Partial<ContactInput>;
  companies: Option[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  onDone: (id?: string) => void;
}) {
  const form = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", companyIds: [], ...defaults },
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ContactData) {
    const res = contactId
      ? await updateContact({ ...values, id: contactId })
      : await createContact(values);
    if (!res.ok) {
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) {
        setError(k as keyof ContactInput, { message: msg });
      }
      toast.error(res.error);
      return;
    }
    toast.success(contactId ? "Contact diperbarui" : "Contact dibuat");
    onDone(contactId ?? (res.data as { id: string } | undefined)?.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="name" label="Nama" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
        </FormField>
        <FormField id="phone" label="Telepon" error={errors.phone?.message}>
          <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
        </FormField>
      </div>
      <FormField id="jobTitle" label="Jabatan" error={errors.jobTitle?.message}>
        <Input id="jobTitle" {...register("jobTitle")} />
      </FormField>
      <FormField id="address" label="Alamat" error={errors.address?.message}>
        <Input id="address" {...register("address")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="city" label="Kota" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </FormField>
        <FormField id="country" label="Negara" error={errors.country?.message}>
          <Input id="country" {...register("country")} />
        </FormField>
      </div>
      <div className="space-y-1.5">
        <Label>Company</Label>
        <Controller
          control={control}
          name="companyIds"
          render={({ field }) => (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
              {companies.length === 0 && (
                <p className="text-muted-foreground text-xs">Belum ada company.</p>
              )}
              {companies.map((c) => {
                const checked = (field.value ?? []).includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        field.onChange(
                          v
                            ? [...(field.value ?? []), c.id]
                            : (field.value ?? []).filter((x) => x !== c.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
          )}
        />
        <p className="text-muted-foreground text-xs">Company pertama yang dipilih menjadi utama.</p>
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
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
