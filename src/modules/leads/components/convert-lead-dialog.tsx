"use client";

import { ArrowRightLeft } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DuplicateMatch } from "@/modules/duplicates/server/detect";
import { convertLead } from "@/modules/leads/server/actions";

export function ConvertLeadDialog({
  leadId,
  leadName,
  hasCompanyName,
  companyName,
  suggestions,
  defaults,
}: {
  leadId: string;
  leadName: string;
  hasCompanyName: boolean;
  companyName: string | null;
  suggestions: { contacts: DuplicateMatch[]; companies: DuplicateMatch[] };
  defaults: { title: string; value: string };
}) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState(
    suggestions.contacts[0] ? `link:${suggestions.contacts[0].id}` : "create",
  );
  const [company, setCompany] = useState(
    suggestions.companies[0]
      ? `link:${suggestions.companies[0].id}`
      : hasCompanyName
        ? "create"
        : "none",
  );
  const [createDeal, setCreateDeal] = useState(true);
  const [title, setTitle] = useState(defaults.title);
  const [value, setValue] = useState(defaults.value);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const party = (v: string, key: "contactId" | "companyId") =>
    v.startsWith("link:")
      ? { mode: "link" as const, [key]: v.slice(5) }
      : { mode: v as "create" | "none" };

  function submit() {
    start(async () => {
      const res = await convertLead({
        leadId,
        contact: party(contact, "contactId") as never,
        company: party(company, "companyId") as never,
        deal: { create: createDeal, title: title || undefined, value: value || undefined },
      });
      if (!res.ok) {
        setError(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
        return;
      }
      setError(undefined);
      // Halaman di-render ulang oleh server (revalidatePath): tombol ini hilang dan kartu "Hasil konversi" muncul.
      toast.success("Lead berhasil dikonversi");
      setOpen(false);
    });
  }

  const contactOptions = [
    ...suggestions.contacts.map((c) => ({
      value: `link:${c.id}`,
      label: `Tautkan ke ${c.name}${c.email ? ` (${c.email})` : ""}`,
    })),
    { value: "create", label: `Buat contact baru “${leadName}”` },
    { value: "none", label: "Tidak membuat contact" },
  ];
  const companyOptions = [
    ...suggestions.companies.map((c) => ({ value: `link:${c.id}`, label: `Tautkan ke ${c.name}` })),
    ...(hasCompanyName ? [{ value: "create", label: `Buat company baru “${companyName}”` }] : []),
    { value: "none", label: "Tidak membuat company" },
  ];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ArrowRightLeft /> Konversi
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <>
            <>
              <DialogHeader>
                <DialogTitle>Konversi “{leadName}”</DialogTitle>
                <DialogDescription>
                  Semua langkah berjalan atomik: bila gagal, tidak ada yang berubah.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <p
                  role="alert"
                  className="bg-tone-red-soft text-tone-red-ink text-label rounded-md px-3 py-2"
                >
                  {error}
                </p>
              )}
              <FormField id="conv-contact" label="Contact">
                <SelectField
                  id="conv-contact"
                  value={contact}
                  onChange={setContact}
                  options={contactOptions}
                />
              </FormField>
              <FormField id="conv-company" label="Company">
                <SelectField
                  id="conv-company"
                  value={company}
                  onChange={setCompany}
                  options={companyOptions}
                />
              </FormField>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="conv-deal"
                  checked={createDeal}
                  onCheckedChange={(v) => setCreateDeal(!!v)}
                />
                <Label htmlFor="conv-deal">Buat deal baru</Label>
              </div>
              {createDeal && (
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                  <FormField id="conv-title" label="Judul deal">
                    <Input
                      id="conv-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </FormField>
                  <FormField id="conv-value" label="Nilai">
                    <Input
                      id="conv-value"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </FormField>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button onClick={submit} disabled={pending}>
                  {pending ? "Mengonversi…" : "Konversi"}
                </Button>
              </DialogFooter>
            </>
          </>
        </DialogContent>
      </Dialog>
    </>
  );
}
