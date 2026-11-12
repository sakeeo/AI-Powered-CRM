"use client";

import { Copy, MessageCircle, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import { normalizePhone } from "@/lib/phone";
import type { ActivityLink } from "@/modules/activities/constants";
import { aiGhostwriteFollowUp } from "@/modules/activities/server/ai-actions";
import type { FollowUpOption } from "@/modules/activities/server/ai";

/** 3 opsi draf follow-up (WA/Email). Hanya salin / buka wa.me — tidak ada pengiriman otomatis. */
export function FollowUpGhostwriter({
  link,
  phone,
}: {
  link: Pick<ActivityLink, "leadId" | "contactId" | "dealId">;
  phone?: string | null;
}) {
  const [options, setOptions] = useState<FollowUpOption[]>([]);
  const [pending, start] = useTransition();
  const wa = normalizePhone(phone);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await aiGhostwriteFollowUp(link);
            if (!res.ok) return void toast.error(res.error);
            setOptions(res.data.options);
          })
        }
      >
        <Sparkles /> {pending ? "Menyusun…" : "Draf follow-up (AI)"}
      </Button>
      {options.length > 0 && (
        <ul className="space-y-2" data-testid="followup-options">
          {options.map((o, i) => (
            <li key={i} className="border-border space-y-1.5 rounded-md border p-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                {o.channel === "whatsapp" ? "WhatsApp" : "Email"}
                {o.subject ? ` · ${o.subject}` : ""}
              </p>
              <p className="text-sm whitespace-pre-wrap">{o.text}</p>
              <div className="flex gap-2">
                <RowAction
                  icon={Copy}
                  label="Salin"
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard.writeText(o.text).then(() => toast.success("Disalin"))
                  }
                />
                {o.channel === "whatsapp" && wa && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="max-lg:size-10 max-lg:rounded-full max-lg:px-0"
                  >
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(o.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Buka WhatsApp"
                    >
                      <MessageCircle /> <span className="max-lg:sr-only">Buka WhatsApp</span>
                    </a>
                  </Button>
                )}
              </div>
            </li>
          ))}
          <p className="text-muted-foreground text-xs">
            Draf AI — periksa sebelum mengirim. Pesan tidak dikirim otomatis.
          </p>
        </ul>
      )}
    </div>
  );
}
