"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AI_PROVIDERS, AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";
import { saveAiConnector } from "@/modules/connectors/server/actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

/**
 * Form connector AI TUNGGAL untuk semua provider. Provider dipilih lewat select (terkunci saat
 * mengubah connector yang sudah ada); hint key & model default mengikuti provider terpilih.
 * Mount dengan `key` baru setiap dibuka agar state form selalu segar.
 */
export function AiConnectorForm({
  open,
  onOpenChange,
  initialProvider,
  connectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider: AiProvider;
  connectors: Map<string, ConnectorView>;
}) {
  const [provider, setProvider] = useState<AiProvider>(initialProvider);
  const existing = connectors.get(AI_PROVIDER_INFO[provider].type);
  const info = AI_PROVIDER_INFO[provider];
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(existing?.model ?? info.defaultModel);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const editing = !!connectors.get(AI_PROVIDER_INFO[initialProvider].type);

  function changeProvider(next: string) {
    const p = next as AiProvider;
    setProvider(p);
    setApiKey("");
    setError(undefined);
    setModel(connectors.get(AI_PROVIDER_INFO[p].type)?.model ?? AI_PROVIDER_INFO[p].defaultModel);
  }

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
      onOpenChange(false);
    });
  }

  const modelError = error?.toLowerCase().includes("model") ? error : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>{editing ? `Ubah ${info.title}` : "Hubungkan AI model"}</DialogTitle>
            <DialogDescription>
              Key dienkripsi di server dan tidak pernah ditampilkan kembali.
            </DialogDescription>
          </DialogHeader>
          <FormField id="ai-provider" label="Provider" hint={info.description}>
            <SelectField
              id="ai-provider"
              value={provider}
              onChange={changeProvider}
              disabled={editing}
              options={AI_PROVIDERS.map((p) => ({ value: p, label: AI_PROVIDER_INFO[p].title }))}
            />
          </FormField>
          <FormField
            id="ai-key"
            label="API key"
            hint={
              existing ? "Kosongkan untuk mempertahankan key saat ini." : `Contoh: ${info.keyHint}`
            }
            error={error && !modelError ? error : undefined}
          >
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={existing?.maskedHint ?? ""}
            />
          </FormField>
          <FormField id="ai-model" label="Model" error={modelError}>
            <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
