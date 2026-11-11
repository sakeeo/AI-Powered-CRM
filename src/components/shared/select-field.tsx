"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

/** Select dengan opsi "kosong" (Radix tidak mengizinkan value ""). value/onChange memakai string kosong untuk "tidak dipilih". */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  disabled,
}: {
  id?: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  noneLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ? value : noneLabel ? NONE : undefined}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
