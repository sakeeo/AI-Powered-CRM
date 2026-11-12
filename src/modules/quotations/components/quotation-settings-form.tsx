"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUOTATION_DISCLAIMER } from "@/modules/quotations/calc";
import { saveQuotationSettings } from "@/modules/quotations/server/actions";

type S = {
  taxLabel: string;
  taxRate: string;
  taxInclusive: boolean;
  validityDays: number;
  terms: string | null;
};

export function QuotationSettingsForm({ initial, canEdit }: { initial: S; canEdit: boolean }) {
  const [s, setS] = useState({
    ...initial,
    terms: initial.terms ?? "",
    validityDays: String(initial.validityDays),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Pengaturan quotation</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveQuotationSettings({
                ...s,
                validityDays: Number(s.validityDays),
              });
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                return void toast.error(res.error);
              }
              setErrors({});
              toast.success("Pengaturan disimpan");
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="qs-label" label="Label pajak" error={errors.taxLabel}>
              <Input
                id="qs-label"
                value={s.taxLabel}
                disabled={!canEdit}
                onChange={(e) => setS({ ...s, taxLabel: e.target.value })}
              />
            </FormField>
            <FormField id="qs-rate" label="Tarif pajak (%)" error={errors.taxRate}>
              <NumberInput
                id="qs-rate"
                value={s.taxRate}
                disabled={!canEdit}
                onValueChange={(v) => setS({ ...s, taxRate: v })}
              />
            </FormField>
            <FormField id="qs-days" label="Masa berlaku default (hari)" error={errors.validityDays}>
              <NumberInput
                id="qs-days"
                decimals={0}
                value={s.validityDays}
                disabled={!canEdit}
                onValueChange={(v) => setS({ ...s, validityDays: v })}
              />
            </FormField>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="qs-incl"
                checked={s.taxInclusive}
                disabled={!canEdit}
                onCheckedChange={(v) => setS({ ...s, taxInclusive: v === true })}
              />
              <Label htmlFor="qs-incl">Harga sudah termasuk pajak</Label>
            </div>
          </div>
          <FormField id="qs-terms" label="Syarat & ketentuan default" error={errors.terms}>
            <Textarea
              id="qs-terms"
              rows={4}
              value={s.terms}
              disabled={!canEdit}
              onChange={(e) => setS({ ...s, terms: e.target.value })}
            />
          </FormField>
          <p className="text-muted-foreground text-xs">
            Berlaku untuk quotation baru; quotation yang sudah dibuat menyimpan pengaturannya
            sendiri. {QUOTATION_DISCLAIMER}
          </p>
          {canEdit && (
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
