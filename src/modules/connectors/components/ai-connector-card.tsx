"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";
import {
  removeAiConnector,
  saveAiConnector,
  setDefaultAiConnector,
  testAiConnector,
} from "@/modules/connectors/server/actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

export function AiConnectorCard({
  provider,
  connector,
  canManage,
}: {
  provider: AiProvider;
  connector?: ConnectorView;
  canManage: boolean;
}) {
  const info = AI_PROVIDER_INFO[provider];
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(connector?.model ?? info.defaultModel);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveAiConnector({ provider, apiKey: apiKey || undefined, model });
      if (!res.ok) {
        setError(res.fieldErrors?.model ?? res.error);
        return;
      }
      toast.success(`${info.title} disimpan`);
      setApiKey(""); // jangan menyimpan key di state setelah dikirim
      setError(undefined);
      setOpen(false);
    });
  }

  function test() {
    start(async () => {
      const res = await testAiConnector({ provider });
      if (!res.ok) toast.error(res.error);
      else if (res.data.ok) toast.success("Koneksi berhasil");
      else toast.error(res.data.error);
    });
  }

  const badge = !connector ? (
    <Badge variant="outline">Belum terhubung</Badge>
  ) : connector.status === "error" ? (
    <Badge variant="destructive">Error</Badge>
  ) : (
    <Badge variant="secondary">Terhubung</Badge>
  );

  return (
    <Card className="p-card gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-md font-semibold">{info.title}</h4>
          <p className="text-muted-foreground text-xs">{info.description}</p>
        </div>
        {badge}
      </div>
      {connector && (
        <dl className="text-label grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">API key</dt>
          <dd className="font-mono">{connector.maskedHint}</dd>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="truncate">{connector.model ?? info.defaultModel}</dd>
          {connector.lastTestedAt && (
            <>
              <dt className="text-muted-foreground">Tes terakhir</dt>
              <dd className={connector.lastTestOk ? "text-tone-green-ink" : "text-tone-red-ink"}>
                {connector.lastTestOk ? "Berhasil" : (connector.lastTestError ?? "Gagal")}
              </dd>
            </>
          )}
        </dl>
      )}
      {connector?.isDefault && <Badge className="w-fit">Default untuk fitur AI</Badge>}
      {canManage && (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => setOpen(true)}>
            {connector ? "Ubah" : "Hubungkan"}
          </Button>
          {connector && (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={pending}>
                Test koneksi
              </Button>
              {!connector.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => void (await setDefaultAiConnector({ provider })))
                  }
                >
                  Jadikan default
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeAiConnector({ provider });
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Connector dihapus");
                  })
                }
              >
                Hapus
              </Button>
            </>
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={save} className="space-y-4" autoComplete="off">
            <DialogHeader>
              <DialogTitle>{info.title}</DialogTitle>
              <DialogDescription>
                Key dienkripsi di server dan tidak pernah ditampilkan kembali.
              </DialogDescription>
            </DialogHeader>
            <FormField
              id={`key-${provider}`}
              label="API key"
              hint={
                connector
                  ? "Kosongkan untuk mempertahankan key saat ini."
                  : `Contoh: ${info.keyHint}`
              }
              error={error && !error.includes("model") ? error : undefined}
            >
              <Input
                id={`key-${provider}`}
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={connector?.maskedHint ?? ""}
              />
            </FormField>
            <FormField
              id={`model-${provider}`}
              label="Model"
              error={error?.includes("model") ? error : undefined}
            >
              <Input
                id={`model-${provider}`}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
