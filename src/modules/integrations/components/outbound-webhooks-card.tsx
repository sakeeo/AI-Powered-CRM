"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  OUTBOUND_EVENTS,
  OUTBOUND_EVENT_LABEL,
  OUTBOUND_PROVIDERS,
  OUTBOUND_PROVIDER_INFO,
  type OutboundEvent,
  type OutboundProvider,
} from "@/modules/integrations/constants";
import {
  createOutboundWebhook,
  deleteOutboundWebhook,
  rotateOutboundSecret,
  testOutboundWebhook,
  updateOutboundWebhook,
} from "@/modules/integrations/server/webhook-actions";
import type { OutboundWebhookView } from "@/modules/integrations/server/queries";

type Delivery = {
  id: string;
  webhookId: string;
  event: string;
  status: string;
  attempts: number;
  httpStatus: number | null;
  error: string | null;
  createdAt: Date;
};

type Draft = {
  id?: string;
  provider: OutboundProvider;
  name: string;
  url: string;
  events: OutboundEvent[];
  isActive: boolean;
};

const host = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

function WebhookDialog({
  draft,
  onClose,
  onSecret,
}: {
  draft: Draft;
  onClose: () => void;
  onSecret: (s: string) => void;
}) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const info = OUTBOUND_PROVIDER_INFO[d.provider];
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = d.id
        ? await updateOutboundWebhook({
            id: d.id,
            name: d.name,
            url: d.url,
            events: d.events,
            isActive: d.isActive,
          })
        : await createOutboundWebhook({
            provider: d.provider,
            name: d.name,
            url: d.url,
            events: d.events,
          });
      if (!res.ok) return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      toast.success(d.id ? "Webhook diperbarui" : "Webhook dibuat");
      onClose();
      if (!d.id && res.data && "secret" in res.data) onSecret(res.data.secret);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{d.id ? "Ubah webhook keluar" : "Webhook keluar baru"}</DialogTitle>
            <DialogDescription>
              Event bisnis dikirim sebagai POST JSON bertanda tangan ke URL ini.
            </DialogDescription>
          </DialogHeader>
          <FormField id="ow-provider" label="Tujuan" hint={info.description}>
            <SelectField
              id="ow-provider"
              value={d.provider}
              disabled={!!d.id}
              onChange={(v) => set({ provider: v as OutboundProvider })}
              options={OUTBOUND_PROVIDERS.map((p) => ({
                value: p,
                label: OUTBOUND_PROVIDER_INFO[p].title,
              }))}
            />
          </FormField>
          <FormField id="ow-name" label="Nama">
            <Input id="ow-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <FormField id="ow-url" label="URL (HTTPS)">
            <Input
              id="ow-url"
              placeholder={info.placeholder}
              value={d.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          </FormField>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Event yang dikirim</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {OUTBOUND_EVENTS.map((ev) => (
                <div key={ev} className="flex items-center gap-2">
                  <Checkbox
                    id={`ow-ev-${ev}`}
                    checked={d.events.includes(ev)}
                    onCheckedChange={(c) =>
                      set({
                        events: c === true ? [...d.events, ev] : d.events.filter((x) => x !== ev),
                      })
                    }
                  />
                  <Label htmlFor={`ow-ev-${ev}`}>{OUTBOUND_EVENT_LABEL[ev]}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          {d.id && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="ow-active"
                checked={d.isActive}
                onCheckedChange={(c) => set({ isActive: c === true })}
              />
              <Label htmlFor="ow-active">Aktif</Label>
            </div>
          )}
          {error && (
            <p role="alert" className="text-tone-red-ink text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Webhook keluar (Zapier / Make / kustom): daftar + satu dialog bersama + log pengiriman terakhir. */
export function OutboundWebhooksCard({
  webhooks,
  deliveries,
  canManage,
}: {
  webhooks: OutboundWebhookView[];
  deliveries: Delivery[];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nameOf = new Map(webhooks.map((w) => [w.id, w.name]));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Zapier, Make & webhook keluar</CardTitle>
          <CardDescription>
            Teruskan event bisnis (lead, deal, quotation) ke Zapier/Make atau sistem Anda.
            Pengiriman lewat antrean dengan retry otomatis; setiap kejadian dikirim sekali per
            endpoint.
          </CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button
              onClick={() =>
                setDraft({
                  provider: "zapier",
                  name: "",
                  url: "",
                  events: ["lead.created"],
                  isActive: true,
                })
              }
            >
              <Plus /> Tambah webhook
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {webhooks.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Belum ada webhook keluar.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="outbound-list">
            {webhooks.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{w.name}</span>
                    <Badge variant="outline">{OUTBOUND_PROVIDER_INFO[w.provider].title}</Badge>
                    <ToneBadge tone={w.isActive ? "green" : "orange"}>
                      {w.isActive ? "Aktif" : "Nonaktif"}
                    </ToneBadge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {host(w.url)} · {w.events.map((e) => OUTBOUND_EVENT_LABEL[e] ?? e).join(", ")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Berhasil {w.stats.success} · Gagal {w.stats.failed} · Menunggu {w.stats.pending}
                    <span className="ml-2 font-mono">{w.maskedHint}</span>
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          id: w.id,
                          provider: w.provider,
                          name: w.name,
                          url: w.url,
                          events: w.events,
                          isActive: w.isActive,
                        })
                      }
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await testOutboundWebhook({ id: w.id });
                          if (!res.ok) toast.error(res.error);
                          else if (res.data.ok) toast.success("Event uji terkirim");
                          else toast.error(res.data.error);
                        })
                      }
                    >
                      Kirim uji
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await rotateOutboundSecret({ id: w.id });
                          if (!res.ok) toast.error(res.error);
                          else setSecret(res.data.secret);
                        })
                      }
                    >
                      Putar secret
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteOutboundWebhook({ id: w.id });
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Webhook dihapus");
                        })
                      }
                    >
                      <Trash2 /> Hapus
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {deliveries.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold">Pengiriman terakhir</h4>
            <ul className="divide-y rounded-lg border text-xs" data-testid="delivery-log">
              {deliveries.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <ToneBadge
                    tone={
                      x.status === "success" ? "green" : x.status === "failed" ? "red" : "orange"
                    }
                  >
                    {x.status === "success"
                      ? "Sukses"
                      : x.status === "failed"
                        ? "Gagal"
                        : "Menunggu"}
                  </ToneBadge>
                  <span className="font-medium">{nameOf.get(x.webhookId) ?? "—"}</span>
                  <span>{x.event}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(x.createdAt).toLocaleString("id-ID")} · {x.attempts}×{" "}
                    {x.httpStatus ? `· HTTP ${x.httpStatus}` : ""}
                    {x.error ? ` · ${x.error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      {draft && (
        <WebhookDialog
          key={draft.id ?? "new"}
          draft={draft}
          onClose={() => setDraft(null)}
          onSecret={setSecret}
        />
      )}
      {secret && (
        <Dialog open onOpenChange={(o) => !o && setSecret(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Secret penandatangan</DialogTitle>
              <DialogDescription>
                Hanya tampil sekali. Simpan untuk memverifikasi header X-CRM-Signature.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code
                data-testid="outbound-secret"
                className="bg-muted block flex-1 rounded p-2 text-xs break-all"
              >
                {secret}
              </code>
              <Button
                size="icon"
                variant="outline"
                aria-label="Salin secret"
                onClick={() =>
                  void navigator.clipboard?.writeText(secret).then(() => toast.success("Disalin"))
                }
              >
                <Copy />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Tanda tangan = HMAC-SHA256 atas <code>{"{timestamp}.{body}"}</code> (header{" "}
              <code>X-CRM-Timestamp</code>), dikirim sebagai{" "}
              <code>X-CRM-Signature: sha256=&lt;hex&gt;</code>. Zapier/Make dapat mengabaikannya.
            </p>
            <DialogFooter>
              <Button onClick={() => setSecret(null)}>Selesai</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
