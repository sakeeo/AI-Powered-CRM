"use client";

import { Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateWebhook, toggleWebhook } from "@/modules/webhooks/server/actions";
import type { WebhookView } from "@/modules/webhooks/server/queries";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Diterima",
  invalid_signature: "Signature salah",
  invalid_payload: "Payload tidak valid",
  inactive: "Webhook nonaktif",
  rate_limited: "Dibatasi",
};

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success("Disalin"));
}

export function WebhookCard({
  webhook,
  canManage,
}: {
  webhook: WebhookView | null;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  // Secret hanya ada di state sampai halaman ditinggalkan; tidak pernah diambil ulang dari server.
  const [secret, setSecret] = useState<string>();
  const [publicId, setPublicId] = useState(webhook?.publicId);
  const url = publicId
    ? `${typeof window === "undefined" ? "" : window.location.origin}/api/webhooks/inbound/${publicId}`
    : null;

  function generate() {
    start(async () => {
      const res = await generateWebhook({});
      if (!res.ok) return void toast.error(res.error);
      setSecret(res.data.secret);
      setPublicId(res.data.publicId);
      toast.success(webhook ? "Secret dirotasi" : "Webhook dibuat");
    });
  }

  return (
    <Card className="p-card gap-3 md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-md font-semibold">Webhook lead (form website)</h4>
          <p className="text-muted-foreground text-xs">
            Kirim POST JSON ke URL di bawah dengan header{" "}
            <code>X-Signature: sha256=&lt;HMAC-SHA256 body&gt;</code>. Lead dibuat dengan sumber
            &ldquo;Website&rdquo;.
          </p>
        </div>
        {webhook && (
          <ToneBadge tone={webhook.isActive ? "green" : "orange"}>
            {webhook.isActive ? "Aktif" : "Nonaktif"}
          </ToneBadge>
        )}
      </div>

      {url ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <code
              className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs"
              data-testid="webhook-url"
            >
              {url}
            </code>
            <Button size="icon" variant="outline" aria-label="Salin URL" onClick={() => copy(url)}>
              <Copy />
            </Button>
          </div>
          {secret ? (
            <div className="border-destructive/40 space-y-1 rounded-md border p-2">
              <p className="text-xs font-medium">
                Simpan secret ini sekarang — tidak akan ditampilkan lagi.
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs"
                  data-testid="webhook-secret"
                >
                  {secret}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Salin secret"
                  onClick={() => copy(secret)}
                >
                  <Copy />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Secret: <code>{webhook?.maskedHint}</code>
            </p>
          )}
        </div>
      ) : null}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={generate}>
            {webhook ? "Rotasi secret" : "Buat webhook"}
          </Button>
          {webhook && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await toggleWebhook({ isActive: !webhook.isActive });
                  if (!res.ok) toast.error(res.error);
                })
              }
            >
              {webhook.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          )}
        </div>
      )}

      {webhook && (
        <div>
          <h5 className="mb-1 text-xs font-semibold">Log penerimaan terakhir</h5>
          {webhook.deliveries.length === 0 ? (
            <p className="text-muted-foreground text-xs">Belum ada permintaan masuk.</p>
          ) : (
            <ul className="divide-border divide-y text-xs" data-testid="webhook-log">
              {webhook.deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="tabular-nums">
                    {new Date(d.createdAt).toLocaleString("id-ID")}
                  </span>
                  <ToneBadge tone={d.status === "accepted" ? "green" : "red"}>
                    {STATUS_LABEL[d.status] ?? d.status} ({d.httpStatus})
                  </ToneBadge>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {d.error ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
