"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { AiConnectorForm } from "@/modules/connectors/components/ai-connector-form";
import { AI_PROVIDERS, AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";
import {
  removeAiConnector,
  setDefaultAiConnector,
  testAiConnector,
} from "@/modules/connectors/server/actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

/** Daftar AI model per provider + SATU form connector bersama (dialog) untuk tambah/ubah. */
export function AiConnectorList({
  connectors,
  canManage,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
}) {
  const byType = new Map(connectors.map((c) => [c.type, c]));
  const [form, setForm] = useState<{ provider: AiProvider; n: number } | null>(null);
  const [pending, start] = useTransition();
  const firstFree =
    AI_PROVIDERS.find((p) => !byType.has(AI_PROVIDER_INFO[p].type)) ?? AI_PROVIDERS[0];

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
          <CardTitle>AI Models (BYOK)</CardTitle>
          <CardDescription>
            Bawa API key Anda sendiri. Semua fitur AI hanya menghasilkan draf yang perlu Anda
            setujui.
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
        {AI_PROVIDERS.map((p) => {
          const info = AI_PROVIDER_INFO[p];
          const c = byType.get(info.type);
          return (
            <div
              key={p}
              data-testid={`ai-row-${p}`}
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
                    <span className="font-mono">{c.maskedHint}</span> ·{" "}
                    {c.model ?? info.defaultModel}
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
                  <Button
                    variant={c ? "outline" : "default"}
                    onClick={() => setForm({ provider: p, n: Date.now() })}
                  >
                    {c ? "Ubah" : "Hubungkan"}
                  </Button>
                  {c && (
                    <>
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await testAiConnector({ provider: p });
                            if (!res.ok) toast.error(res.error);
                            else if (res.data.ok) toast.success("Koneksi berhasil");
                            else toast.error(res.data.error);
                          })
                        }
                      >
                        Test koneksi
                      </Button>
                      {!c.isDefault && (
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            run(() => setDefaultAiConnector({ provider: p }), "Default diubah")
                          }
                        >
                          Jadikan default
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(() => removeAiConnector({ provider: p }), "Connector dihapus")
                        }
                      >
                        <Trash2 /> Hapus
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      {form && (
        <AiConnectorForm
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
