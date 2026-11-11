"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_TYPE_LABEL, type ActivityLink } from "@/modules/activities/constants";
import { createActivity } from "@/modules/activities/server/actions";
import { aiExtractActionItems, aiSummarizeNotes } from "@/modules/activities/server/ai-actions";
import type { ActionItemDraft } from "@/modules/activities/server/ai";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Asisten AI untuk catatan: ringkasan 2 paragraf (masuk ke editor sebagai draf yang bisa diedit)
 * dan ekstraksi action item (draf next activity yang harus dikonfirmasi satu per satu).
 */
export function AiAssist({
  link,
  onSummary,
}: {
  link: ActivityLink;
  onSummary: (html: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ActionItemDraft[]>([]);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles /> Asisten AI
      </Button>
    );
  }
  return (
    <div className="border-border space-y-2 rounded-md border p-3" data-testid="ai-assist">
      <p className="text-muted-foreground text-xs">
        Tempel coretan meeting/telepon. Hasil AI hanya draf — tidak tersimpan sebelum Anda
        mengonfirmasi.
      </p>
      <Textarea
        aria-label="Coretan mentah"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || text.trim().length < 10}
          onClick={() =>
            start(async () => {
              const res = await aiSummarizeNotes({ text });
              if (!res.ok) return void toast.error(res.fieldErrors?.text ?? res.error);
              onSummary(
                res.data.summary
                  .split(/\n{2,}|\n/)
                  .filter(Boolean)
                  .map((p) => `<p>${esc(p)}</p>`)
                  .join(""),
              );
              toast.success("Draf ringkasan dimasukkan ke catatan — periksa sebelum menyimpan");
            })
          }
        >
          Ringkas
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || text.trim().length < 10}
          onClick={() =>
            start(async () => {
              const res = await aiExtractActionItems({ text });
              if (!res.ok) return void toast.error(res.fieldErrors?.text ?? res.error);
              setItems(res.data.items);
              if (!res.data.items.length) toast.info("Tidak ada action item terdeteksi");
            })
          }
        >
          Cari action item
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Tutup
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Draf next activity">
          {items.map((it, i) => (
            <li
              key={`${it.subject}-${i}`}
              className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded p-2 text-sm"
            >
              <span>
                <strong>{ACTIVITY_TYPE_LABEL[it.type]}</strong>: {it.subject}
                {it.dueDate && <span className="text-muted-foreground"> · {it.dueDate}</span>}
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await createActivity({
                        type: it.type,
                        subject: it.subject,
                        dueLocal: it.dueDate,
                        ...link,
                      });
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Next activity dibuat");
                      setItems((cur) => cur.filter((_, j) => j !== i));
                      router.refresh();
                    })
                  }
                >
                  Konfirmasi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}
                >
                  Abaikan
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
