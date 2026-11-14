"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  LeadForm,
  type OwnerOption,
  type SourceOption,
} from "@/modules/leads/components/lead-form";
import type { LeadInput } from "@/modules/leads/schemas";
import { draftLeadFromText } from "@/modules/leads/server/ai-actions";

/** Tempel teks WA/email → AI menyusun draf → user mereview di form lead biasa dan wajib menekan Simpan. */
export function TextToLeadDialog({
  sources,
  owners,
  canAssignOwner,
  defaultCurrency,
}: {
  sources: SourceOption[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Partial<LeadInput>>();
  const [pending, start] = useTransition();

  function close(v: boolean) {
    setOpen(v);
    if (!v) {
      setText("");
      setDraft(undefined);
    }
  }

  function generate() {
    start(async () => {
      const res = await draftLeadFromText({ text });
      if (!res.ok) return void toast.error(res.fieldErrors?.text ?? res.error);
      if (!Object.keys(res.data).length)
        return void toast.error("AI tidak menemukan data lead pada teks ini");
      setDraft(res.data as Partial<LeadInput>);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles /> Dari teks (AI)
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat lead dari teks</DialogTitle>
            <DialogDescription>
              {draft
                ? "Ini hanya draf dari AI. Periksa dan koreksi, lalu klik Simpan untuk membuat lead."
                : "Tempel pesan WhatsApp atau email. AI menyusun draf field; tidak ada yang disimpan otomatis."}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <LeadForm
              defaults={draft}
              sources={sources}
              owners={owners}
              canAssignOwner={canAssignOwner}
              defaultCurrency={defaultCurrency}
              onDone={(id) => {
                close(false);
                if (id) router.push(`/leads/${id}`);
              }}
            />
          ) : (
            <div className="space-y-3">
              <Textarea
                aria-label="Teks pesan"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Contoh: Halo, saya Budi dari PT Maju Jaya, butuh sistem kasir untuk 5 outlet, budget sekitar 20 juta, 0812-3456-7890"
              />
              <Button disabled={pending || text.trim().length < 10} onClick={generate}>
                {pending ? "Memproses…" : "Buat draf"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
