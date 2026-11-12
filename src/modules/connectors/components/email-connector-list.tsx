"use client";

import { Pencil, Plug, Plus, Send, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailConnectorForm } from "@/modules/connectors/components/email-connector-form";
import {
  EMAIL_PROVIDERS,
  EMAIL_PROVIDER_INFO,
  type EmailProvider,
} from "@/modules/connectors/email";
import {
  removeEmailConnector,
  setDefaultEmailConnector,
  testEmailConnector,
} from "@/modules/connectors/server/email-actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

/** Daftar provider Email Delivery + SATU form connector bersama (pola sama dengan AI Models). */
export function EmailConnectorList({
  connectors,
  canManage,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
}) {
  const byType = new Map(connectors.map((c) => [c.type, c]));
  const [form, setForm] = useState<{ provider: EmailProvider; n: number } | null>(null);
  const [pending, start] = useTransition();
  const firstFree =
    EMAIL_PROVIDERS.find((p) => !byType.has(EMAIL_PROVIDER_INFO[p].type)) ?? EMAIL_PROVIDERS[0];

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gagal");
      else toast.success(ok);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Email Delivery</CardTitle>
          <CardDescription>
            Dipakai untuk undangan pengguna, reset password, dan reminder. Pengiriman diproses
            worker dengan retry otomatis.
          </CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button onClick={() => setForm({ provider: firstFree, n: Date.now() })}>
              <Plus /> Tambah connector
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="divide-y">
        {EMAIL_PROVIDERS.map((p) => {
          const info = EMAIL_PROVIDER_INFO[p];
          const c = byType.get(info.type);
          const from = (c?.settings as { from?: string } | null)?.from;
          return (
            <div
              key={p}
              data-testid={`email-row-${p}`}
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 basis-64 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-md font-semibold">{info.title}</h4>
                  {!c ? (
                    <Badge variant="outline">Belum terhubung</Badge>
                  ) : c.status === "error" ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : (
                    <Badge variant="secondary">Terhubung</Badge>
                  )}
                  {c?.isDefault && <Badge>Default</Badge>}
                </div>
                <p className="text-muted-foreground text-xs">{info.description}</p>
                {c && (
                  <p className="text-muted-foreground text-xs">
                    <span className="font-mono">{c.maskedHint}</span>
                    {from && <> · {from}</>}
                    {c.lastTestedAt && (
                      <>
                        {" · Tes: "}
                        <span
                          className={c.lastTestOk ? "text-tone-green-ink" : "text-tone-red-ink"}
                        >
                          {c.lastTestOk ? "berhasil" : (c.lastTestError ?? "gagal")}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <RowAction
                    icon={c ? Pencil : Plug}
                    label={c ? "Ubah" : "Hubungkan"}
                    variant={c ? "outline" : "default"}
                    onClick={() => setForm({ provider: p, n: Date.now() })}
                  />
                  {c && (
                    <>
                      <RowAction
                        icon={Send}
                        label="Kirim email uji"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await testEmailConnector({ provider: p });
                            if (!res.ok) toast.error(res.error);
                            else if (res.data.ok)
                              toast.success("Email uji terkirim ke alamat Anda");
                            else toast.error(res.data.error);
                          })
                        }
                      />
                      {!c.isDefault && (
                        <RowAction
                          icon={Star}
                          label="Jadikan default"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            run(() => setDefaultEmailConnector({ provider: p }), "Default diubah")
                          }
                        />
                      )}
                      <RowAction
                        icon={Trash2}
                        label="Hapus"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(() => removeEmailConnector({ provider: p }), "Connector dihapus")
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      {form && (
        <EmailConnectorForm
          key={form.n}
          open
          onOpenChange={(o) => !o && setForm(null)}
          initialProvider={form.provider}
          connectors={byType}
        />
      )}
    </Card>
  );
}
