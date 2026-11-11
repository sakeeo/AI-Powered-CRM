"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMAIL_PROVIDER_INFO,
  EMAIL_PROVIDERS,
  type EmailProvider,
} from "@/modules/connectors/email";
import {
  removeEmailConnector,
  saveEmailConnector,
  testEmailConnector,
} from "@/modules/connectors/server/email-actions";
import type { ConnectorView } from "@/modules/connectors/server/queries";

type S = { host?: string; port?: number; secure?: boolean; user?: string; from?: string };

/** Kartu Email Delivery: pilih SMTP/Resend, simpan terenkripsi, uji dengan email ke diri sendiri. */
export function EmailConnectorCard({
  connectors,
  canManage,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
}) {
  const active = connectors.find((c) => c.type.startsWith("email_"));
  const current: EmailProvider | undefined = EMAIL_PROVIDERS.find(
    (p) => EMAIL_PROVIDER_INFO[p].type === active?.type,
  );
  const s = (active?.settings ?? {}) as S;
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<EmailProvider>(current ?? "smtp");
  const [host, setHost] = useState(s.host ?? "");
  const [port, setPort] = useState(String(s.port ?? 587));
  const [secure, setSecure] = useState(s.secure ?? false);
  const [user, setUser] = useState(s.user ?? "");
  const [pass, setPass] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [from, setFrom] = useState(s.from ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

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
      toast.success("Email delivery disimpan");
      setPass("");
      setApiKey("");
      setError(undefined);
      setOpen(false);
    });
  }

  return (
    <Card className="p-card gap-3 md:col-span-2 xl:col-span-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-md font-semibold">Email delivery</h4>
          <p className="text-muted-foreground text-xs">
            Dipakai untuk undangan pengguna, reset password, dan reminder. Pengiriman diproses
            worker dengan retry otomatis.
          </p>
        </div>
        {active ? (
          <Badge variant={active.status === "error" ? "destructive" : "secondary"}>
            {active.status === "error" ? "Error" : "Terhubung"}
          </Badge>
        ) : (
          <Badge variant="outline">Belum dikonfigurasi</Badge>
        )}
      </div>
      {active && current && (
        <dl className="text-label grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Penyedia</dt>
          <dd>{EMAIL_PROVIDER_INFO[current].title}</dd>
          <dt className="text-muted-foreground">Akun</dt>
          <dd className="font-mono">{active.maskedHint}</dd>
          <dt className="text-muted-foreground">Pengirim</dt>
          <dd>{s.from}</dd>
          {active.lastTestedAt && (
            <>
              <dt className="text-muted-foreground">Tes terakhir</dt>
              <dd className={active.lastTestOk ? "text-tone-green-ink" : "text-tone-red-ink"}>
                {active.lastTestOk ? "Berhasil" : (active.lastTestError ?? "Gagal")}
              </dd>
            </>
          )}
        </dl>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            {active ? "Ubah" : "Konfigurasi"}
          </Button>
          {active && current && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await testEmailConnector({ provider: current });
                    if (!res.ok) toast.error(res.error);
                    else if (res.data.ok) toast.success("Email uji terkirim ke alamat Anda");
                    else toast.error(res.data.error);
                  })
                }
              >
                Kirim email uji
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeEmailConnector({ provider: current });
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
          <DialogHeader>
            <DialogTitle>Email delivery</DialogTitle>
            <DialogDescription>
              Rahasia disimpan terenkripsi dan tidak pernah ditampilkan kembali.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3" noValidate>
            <FormField id="email-provider" label="Penyedia">
              <SelectField
                id="email-provider"
                value={provider}
                onChange={(v) => setProvider(v as EmailProvider)}
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
                    <Input
                      id="smtp-port"
                      inputMode="numeric"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                  </FormField>
                  <div className="flex items-end gap-2 pb-2">
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
                <FormField
                  id="smtp-pass"
                  label="Password"
                  hint={active ? "Kosongkan untuk mempertahankan yang tersimpan." : undefined}
                >
                  <Input
                    id="smtp-pass"
                    type="password"
                    autoComplete="new-password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </FormField>
              </>
            ) : (
              <FormField
                id="resend-key"
                label="API key"
                hint={active ? "Kosongkan untuk mempertahankan yang tersimpan." : "re_…"}
              >
                <Input
                  id="resend-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
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
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
