"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { setLostCategory } from "@/modules/deals/server/actions";
import { LOST_CATEGORIES } from "@/modules/reports/constants";
import { aiSuggestLostCategory } from "@/modules/reports/server/ai-actions";

/** Kategori alasan Lost: AI hanya mengusulkan (mengisi pilihan); kategori baru tersimpan setelah user menekan Simpan. */
export function LostCategoryEditor({
  id,
  reason,
  category,
  canEdit,
}: {
  id: string;
  reason: string;
  category: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(category ?? "");
  const [pending, start] = useTransition();
  if (!canEdit) return <span>{category ?? "Belum dikategorikan"}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lost-category">
      <div className="w-48">
        <SelectField
          id="lost-cat"
          value={value}
          onChange={setValue}
          placeholder="Pilih kategori"
          options={LOST_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await aiSuggestLostCategory({ text: reason });
            if (!res.ok) return void toast.error(res.fieldErrors?.text ?? res.error);
            setValue(res.data.category);
            toast.info(`Usulan AI: ${res.data.category} — klik Simpan untuk menetapkan`);
          })
        }
      >
        <Sparkles /> Usulkan (AI)
      </Button>
      <Button
        size="sm"
        disabled={pending || !value || value === category}
        onClick={() =>
          start(async () => {
            const res = await setLostCategory({ id, category: value as never });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Kategori disimpan");
            router.refresh();
          })
        }
      >
        Simpan
      </Button>
    </div>
  );
}
