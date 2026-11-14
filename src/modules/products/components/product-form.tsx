"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { FormActions } from "@/components/shared/form-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_CODES } from "@/lib/money";
import { productSchema, type ProductData, type ProductInput } from "@/modules/products/schemas";
import { createProduct, updateProduct } from "@/modules/products/server/actions";

export function ProductForm({
  productId,
  defaults,
  categories,
  defaultCurrency,
  onDone,
}: {
  productId?: string;
  defaults?: Partial<ProductInput>;
  categories: string[];
  defaultCurrency: string;
  onDone: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput, unknown, ProductData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: "",
      currency: defaultCurrency as ProductInput["currency"],
      isActive: true,
      ...defaults,
    },
  });

  async function onSubmit(values: ProductData) {
    const res = productId
      ? await updateProduct({ ...values, id: productId })
      : await createProduct(values);
    if (!res.ok) {
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {}))
        setError(k as keyof ProductInput, { message: msg });
      return void toast.error(res.error);
    }
    toast.success(productId ? "Produk diperbarui" : "Produk dibuat");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="name" label="Nama produk/layanan" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sku" label="SKU (opsional)" error={errors.sku?.message}>
          <Input id="sku" {...register("sku")} />
        </FormField>
        <FormField
          id="categoryName"
          label="Kategori"
          error={errors.categoryName?.message}
          hint="Pilih yang ada atau ketik baru."
        >
          <Input id="categoryName" list="product-categories" {...register("categoryName")} />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <FormField id="price" label="Harga" error={errors.price?.message}>
          <Controller
            control={control}
            name="price"
            render={({ field }) => (
              <NumberInput
                id="price"
                decimals={2}
                value={String(field.value ?? "")}
                onValueChange={field.onChange}
                aria-invalid={!!errors.price}
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
      <FormField id="description" label="Deskripsi" error={errors.description?.message}>
        <Textarea id="description" rows={3} {...register("description")} />
      </FormField>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Checkbox
              id="isActive"
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          )}
        />
        <Label htmlFor="isActive">Aktif (bisa dipilih pada deal)</Label>
      </div>
      <FormActions>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan…" : "Simpan"}
        </Button>
      </FormActions>
    </form>
  );
}
