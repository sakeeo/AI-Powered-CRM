import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Label + kontrol + pesan error (RHF). `id` harus sama dengan id kontrol. */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-tone-red-ink text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
