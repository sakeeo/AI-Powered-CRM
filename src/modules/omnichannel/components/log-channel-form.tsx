"use client";

import { MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logChannelMessage } from "@/modules/omnichannel/server/actions";

/** Catat percakapan di kanal tanpa integrasi (Instagram, Telegram, dst.). Hanya mencatat, tidak mengirim. */
export function LogChannelForm({ subject }: { subject: { type: "contact" | "lead"; id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [body, setBody] = useState("");
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MessageSquarePlus /> Catat percakapan lain
      </Button>
    );
  return (
    <form
      className="w-full space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await logChannelMessage({
            ...(subject.type === "contact" ? { contactId: subject.id } : { leadId: subject.id }),
            channelLabel: label,
            direction,
            body,
          });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Percakapan dicatat");
            setOpen(false);
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="ch-label">Kanal</Label>
          <Input
            id="ch-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="mis. Instagram, Telegram"
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="ch-dir">Arah</Label>
          <SelectField
            id="ch-dir"
            value={direction}
            onChange={(v) => setDirection((v || "in") as "in" | "out")}
            options={[
              { value: "in", label: "Masuk (dari pelanggan)" },
              { value: "out", label: "Keluar (dari kami)" },
            ]}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ch-body">Isi pesan</Label>
        <Textarea id="ch-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !label.trim() || !body.trim()}>
          Catat
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}
