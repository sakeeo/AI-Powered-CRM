"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
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
import { NumberInput } from "@/components/ui/number-input";
import {
  EMAIL_PROVIDERS,
  EMAIL_PROVIDER_INFO,
  type EmailProvider,
} from "@/modules/connectors/email";
import { saveEmailConnector } from "@/modules/connectors/server/email-actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

type S = { host?: string; port?: number; secure?: boolean; user?: string; from?: string };

/**
 * Form connector email TUNGGAL untuk semua provider (pola sama dengan AI). Provider dipilih lewat
 * select (terkunci saat mengubah); field menyesuaikan provider. Mount dengan `key` baru tiap dibuka.
 */
export function EmailConnectorForm({
  open,
  onOpenChange,
  initialProvider,
  connectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider: EmailProvider;
  connectors: Map<string, ConnectorView>;
}) {
  const existingOf = (p: EmailProvider) => connectors.get(EMAIL_PROVIDER_INFO[p].type);
  const settingsOf = (p: EmailProvider) => (existingOf(p)?.settings ?? {}) as S;
  const init = settingsOf(initialProvider);
  const editing = !!existingOf(initialProvider);

  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [host, setHost] = useState(init.host ?? "");
  const [port, setPort] = useState(String(init.port ?? 587));
  const [secure, setSecure] = useState(init.secure ?? false);
  const [user, setUser] = useState(init.user ?? "");
  const [pass, setPass] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [from, setFrom] = useState(init.from ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const existing = existingOf(provider);
  const info = EMAIL_PROVIDER_INFO[provider];

  function changeProvider(next: string) {
    const p = next as EmailProvider;
    const s = settingsOf(p);
    setProvider(p);
    setHost(s.host ?? "");
    setPort(String(s.port ?? 587));
    setSecure(s.secure ?? false);
    setUser(s.user ?? "");
    setFrom(s.from ?? "");
    setPass("");
    setApiKey("");
    setError(undefined);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res =
        provider === "smtp"
          ? await saveEmailConnector({
              provider,
              host,
              port: Number(port),
              secure,
              user,
              pass: pass || undefined,
              from,
            })
          : await saveEmailConnector({ provider, apiKey: apiKey || undefined, from });
      if (!res.ok) return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      toast.success(`${info.title} disimpan`);
      setPass("");
      setApiKey("");
      setError(undefined);
      onOpenChange(false);
    });
  }

  const keepHint = existing ? "Kosongkan untuk mempertahankan yang tersimpan." : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4" noValidate autoComplete="off">
          <DialogHeader>
            <DialogTitle>{editing ? `Ubah ${info.title}` : "Hubungkan email delivery"}</DialogTitle>
            <DialogDescription>
              Rahasia disimpan terenkripsi dan tidak pernah ditampilkan kembali.
            </DialogDescription>
          </DialogHeader>
          <FormField id="email-provider" label="Provider" hint={info.description}>
            <SelectField
              id="email-provider"
              value={provider}
              onChange={changeProvider}
              disabled={editing}
              options={EMAIL_PROVIDERS.map((p) => ({
                value: p,
                label: EMAIL_PROVIDER_INFO[p].title,
              }))}
            />
          </FormField>
          {provider === "smtp" ? (
            <>
              <FormField id="smtp-host" label="Host">
                <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField id="smtp-port" label="Port">
                  <NumberInput id="smtp-port" decimals={0} value={port} onValueChange={setPort} />
                </FormField>
                <div className="flex items-end gap-2 pb-3">
                  <Checkbox
                    id="smtp-secure"
                    checked={secure}
                    onCheckedChange={(v) => setSecure(v === true)}
                  />
                  <Label htmlFor="smtp-secure">TLS langsung (port 465)</Label>
                </div>
              </div>
              <FormField id="smtp-user" label="Username">
                <Input
                  id="smtp-user"
                  autoComplete="off"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </FormField>
              <FormField id="smtp-pass" label="Password" hint={keepHint}>
                <Input
                  id="smtp-pass"
                  type="password"
                  autoComplete="new-password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder={existing?.maskedHint ?? ""}
                />
              </FormField>
            </>
          ) : (
            <FormField id="resend-key" label="API key" hint={keepHint ?? "Contoh: re_…"}>
              <Input
                id="resend-key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={existing?.maskedHint ?? ""}
              />
            </FormField>
          )}
          <FormField
            id="email-from"
            label="Alamat pengirim"
            error={error}
            hint="Mis. CRM <noreply@perusahaan.com>"
          >
            <Input id="email-from" value={from} onChange={(e) => setFrom(e.target.value)} />
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
