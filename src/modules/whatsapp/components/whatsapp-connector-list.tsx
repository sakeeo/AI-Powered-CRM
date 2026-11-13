"use client";

import { Copy, KeyRound, Pencil, PlugZap, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/shared/row-action";
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
import type { ConnectorView } from "@/modules/connectors/server/queries";
import { WA_PROVIDERS, WA_PROVIDER_INFO, type WaProvider } from "@/modules/whatsapp/constants";
import {
  removeWhatsappConnector,
  rotateWhatsappSecret,
  saveWhatsappConnector,
  setDefaultWhatsappConnector,
  testWhatsappConnector,
} from "@/modules/whatsapp/server/connector-actions";

type S = { publicId?: string; apiUrl?: string };

function webhookUrl(publicId: string) {
  return `${window.location.origin}/api/webhooks/whatsapp/${publicId}`;
}

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(() => toast.success("Disalin"));
}

function ConnectorForm({
  initialProvider,
  connectors,
  onClose,
  onSecret,
}: {
  initialProvider: WaProvider;
  connectors: Map<string, ConnectorView>;
  onClose: () => void;
  onSecret: (s: { publicId: string; secret: string }) => void;
}) {
  const existingOf = (p: WaProvider) => connectors.get(WA_PROVIDER_INFO[p].type);
  const [provider, setProvider] = useState<WaProvider>(initialProvider);
  const [token, setToken] = useState("");
  const [apiUrl, setApiUrl] = useState(
    ((existingOf(initialProvider)?.settings ?? {}) as S).apiUrl ?? "",
  );
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const editing = !!existingOf(initialProvider);
  const info = WA_PROVIDER_INFO[provider];

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res =
        provider === "http"
          ? await saveWhatsappConnector({ provider, token: token || undefined, apiUrl })
          : await saveWhatsappConnector({ provider, token: token || undefined });
      if (!res.ok) return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      toast.success(`${info.title} disimpan`);
      onClose();
      if (res.data.webhookSecret)
        onSecret({ publicId: res.data.publicId, secret: res.data.webhookSecret });
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4" noValidate autoComplete="off">
          <DialogHeader>
            <DialogTitle>{editing ? `Ubah ${info.title}` : "Hubungkan WhatsApp"}</DialogTitle>
            <DialogDescription>
              Token disimpan terenkripsi dan tidak pernah ditampilkan kembali.
            </DialogDescription>
          </DialogHeader>
          <FormField id="wa-provider" label="Provider" hint={info.description}>
            <SelectField
              id="wa-provider"
              value={provider}
              onChange={(p) => setProvider(p as WaProvider)}
              disabled={editing}
              options={WA_PROVIDERS.map((p) => ({ value: p, label: WA_PROVIDER_INFO[p].title }))}
            />
          </FormField>
          {provider === "http" && (
            <FormField id="wa-url" label="URL gateway (HTTPS)">
              <Input id="wa-url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
            </FormField>
          )}
          <FormField
            id="wa-token"
            label="Token / API key"
            hint={editing ? "Kosongkan untuk mempertahankan yang tersimpan." : undefined}
          >
            <Input
              id="wa-token"
              type="password"
              autoComplete="new-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </FormField>
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

/** Daftar provider WhatsApp + SATU form bersama (pola sama dengan AI/Email). */
export function WhatsappConnectorList({
  connectors,
  canManage,
  launch,
  manage,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
  launch?: { provider: WaProvider; n: number };
  /** Permintaan membuka dialog kelola (detail + aksi) dari kartu. */
  manage?: { provider: WaProvider; n: number };
}) {
  const byType = new Map(connectors.map((c) => [c.type, c]));
  const [form, setForm] = useState<{ provider: WaProvider; n: number } | null>(null);
  const [secret, setSecret] = useState<{ publicId: string; secret: string } | null>(null);
  const [pending, start] = useTransition();
  const [seen, setSeen] = useState(launch?.n);
  if (launch && launch.n !== seen) {
    setSeen(launch.n);
    setForm(launch);
  }
  const [managed, setManaged] = useState<WaProvider | null>(manage?.provider ?? null);
  const [seenManage, setSeenManage] = useState(manage?.n);
  if (manage && manage.n !== seenManage) {
    setSeenManage(manage.n);
    setManaged(manage.provider);
  }
  const managedP = managed && byType.has(WA_PROVIDER_INFO[managed].type) ? managed : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gagal");
      else toast.success(ok);
    });
  }

  const extras = (
    <>
      {form && (
        <ConnectorForm
          key={form.n}
          initialProvider={form.provider}
          connectors={byType}
          onClose={() => setForm(null)}
          onSecret={setSecret}
        />
      )}
      {secret && (
        <Dialog open onOpenChange={(o) => !o && setSecret(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfigurasi webhook gateway</DialogTitle>
              <DialogDescription>
                Secret hanya tampil sekali. Simpan sekarang; hilang berarti harus diputar ulang.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">URL webhook (POST)</p>
                <code className="bg-muted block rounded p-2 text-xs break-all">
                  {webhookUrl(secret.publicId)}
                </code>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Secret</p>
                <div className="flex items-center gap-2">
                  <code
                    data-testid="wa-secret"
                    className="bg-muted block flex-1 rounded p-2 text-xs break-all"
                  >
                    {secret.secret}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Salin secret"
                    onClick={() => copy(secret.secret)}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Tanda tangani body dengan HMAC-SHA256 (header{" "}
                <code>X-Signature: sha256=&lt;hex&gt;</code>), atau tambahkan{" "}
                <code>?token=&lt;secret&gt;</code> pada URL bila gateway tidak mendukung header
                kustom.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setSecret(null)}>Selesai</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
  return (
    <>
      <Dialog open={!!managedP} onOpenChange={(o) => !o && setManaged(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola connector</DialogTitle>
            <DialogDescription>
              Detail, webhook, tes koneksi, dan secret gateway WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {(managedP ? [managedP] : []).map((p) => {
            const info = WA_PROVIDER_INFO[p];
            const c = byType.get(info.type)!;
            const publicId = (c.settings as S | null)?.publicId;
            return (
              <div
                key={p}
                data-testid={`wa-row-${p}`}
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
                    {c.isDefault && <Badge>Default</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs">{info.description}</p>
                  {
                    <p className="text-muted-foreground text-xs">
                      <span className="font-mono">{c.maskedHint}</span>
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
                  {publicId && (
                    <div className="flex items-center gap-1.5">
                      <code className="bg-muted max-w-full truncate rounded px-1.5 py-0.5 text-xs">
                        {`/api/webhooks/whatsapp/${publicId}`}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Salin URL webhook"
                        onClick={() => copy(webhookUrl(publicId))}
                      >
                        <Copy />
                      </Button>
                    </div>
                  )}
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
                          label="Test Connection"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await testWhatsappConnector({ provider: p });
                              if (!res.ok) toast.error(res.error);
                              else if (res.data.ok) toast.success("Koneksi gateway berhasil");
                              else toast.error(res.data.error);
                            })
                          }
                        />
                        <RowAction
                          icon={KeyRound}
                          label="Putar secret"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await rotateWhatsappSecret({ provider: p });
                              if (!res.ok) toast.error(res.error);
                              else if (publicId)
                                setSecret({ publicId, secret: res.data.webhookSecret });
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
                              run(
                                () => setDefaultWhatsappConnector({ provider: p }),
                                "Default diubah",
                              )
                            }
                          />
                        )}
                        <RowAction
                          icon={Trash2}
                          label="Hapus"
                          variant="destructive"
                          disabled={pending}
                          onClick={() =>
                            run(() => removeWhatsappConnector({ provider: p }), "Connector dihapus")
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
      {extras}
    </>
  );
}
