"use client";

import { Pencil, PlugZap, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/shared/row-action";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiConnectorForm } from "@/modules/connectors/components/ai-connector-form";
import { AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";
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
  launch,
  manage,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
  /** Permintaan membuka form dari katalog (n berubah = buka lagi). */
  launch?: { provider: AiProvider; n: number };
  /** Permintaan membuka dialog kelola (detail + aksi) dari kartu. */
  manage?: { provider: AiProvider; n: number };
}) {
  const byType = new Map(connectors.map((c) => [c.type, c]));
  const [form, setForm] = useState<{ provider: AiProvider; n: number } | null>(null);
  const [pending, start] = useTransition();
  const [seen, setSeen] = useState(launch?.n);
  if (launch && launch.n !== seen) {
    setSeen(launch.n);
    setForm(launch);
  }
  const [managed, setManaged] = useState<AiProvider | null>(manage?.provider ?? null);
  const [seenManage, setSeenManage] = useState(manage?.n);
  if (manage && manage.n !== seenManage) {
    setSeenManage(manage.n);
    setManaged(manage.provider);
  }
  const managedP = managed && byType.has(AI_PROVIDER_INFO[managed].type) ? managed : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gagal");
      else toast.success(ok);
    });
  }

  const formEl = form && (
    <AiConnectorForm
      key={form.n}
      open
      onOpenChange={(o) => !o && setForm(null)}
      initialProvider={form.provider}
      connectors={byType}
    />
  );
  return (
    <>
      <Dialog open={!!managedP} onOpenChange={(o) => !o && setManaged(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola connector</DialogTitle>
            <DialogDescription>Detail, tes koneksi, dan pengaturan model AI.</DialogDescription>
          </DialogHeader>
          {(managedP ? [managedP] : []).map((p) => {
            const info = AI_PROVIDER_INFO[p];
            const c = byType.get(info.type)!;
            return (
              <div
                key={p}
                data-testid={`ai-row-${p}`}
                className="flex flex-wrap items-center justify-between gap-3 py-1"
              >
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-md font-semibold">{info.title}</h4>
                    {c.status === "error" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">Terhubung</Badge>
                    )}
                    {c?.isDefault && <Badge>Default</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs">{info.description}</p>
                  {
                    <p className="text-muted-foreground text-xs">
                      <span className="font-mono">{c.maskedHint}</span> ·{" "}
                      {c.model ?? info.defaultModel}
                      {c.baseUrl && (
                        <>
                          {" "}
                          · <span className="font-mono">{c.baseUrl}</span>
                        </>
                      )}
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
                  }
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <RowAction
                      icon={Pencil}
                      label="Ubah"
                      variant="outline"
                      onClick={() => setForm({ provider: p, n: Date.now() })}
                    />
                    {
                      <>
                        <RowAction
                          icon={PlugZap}
                          label="Test koneksi"
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
                        />
                        {!c.isDefault && (
                          <RowAction
                            icon={Star}
                            label="Jadikan default"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() => setDefaultAiConnector({ provider: p }), "Default diubah")
                            }
                          />
                        )}
                        <RowAction
                          icon={Trash2}
                          label="Hapus"
                          variant="destructive"
                          disabled={pending}
                          onClick={() =>
                            run(() => removeAiConnector({ provider: p }), "Connector dihapus")
                          }
                        />
                      </>
                    }
                  </div>
                )}
              </div>
            );
          })}
        </DialogContent>
      </Dialog>
      {formEl}
    </>
  );
}
