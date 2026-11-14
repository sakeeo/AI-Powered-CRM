"use client";

import {
  Cable,
  Mail,
  MessageCircle,
  Search,
  Sparkles,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { IconTile } from "@/components/shared/icon-tile";
import type { Tone } from "@/components/shared/tone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiConnectorList } from "@/modules/connectors/components/ai-connector-list";
import { EmailConnectorList } from "@/modules/connectors/components/email-connector-list";
import {
  EMAIL_PROVIDERS,
  EMAIL_PROVIDER_INFO,
  type EmailProvider,
} from "@/modules/connectors/email";
import { AI_PROVIDERS, AI_PROVIDER_INFO, type AiProvider } from "@/modules/connectors/registry";
import type { ConnectorView } from "@/modules/connectors/server/queries";
import { EventCatalog } from "@/modules/integrations/components/event-catalog";
import { OutboundWebhooksCard } from "@/modules/integrations/components/outbound-webhooks-card";
import { WebhookCard } from "@/modules/webhooks/components/webhook-card";
import type { WebhookView } from "@/modules/webhooks/server/queries";
import { WhatsappConnectorList } from "@/modules/whatsapp/components/whatsapp-connector-list";
import { WA_PROVIDERS, WA_PROVIDER_INFO, type WaProvider } from "@/modules/whatsapp/constants";

type Category = "ai" | "whatsapp" | "email" | "webhook";
const CATEGORY: Record<Category, { label: string; icon: LucideIcon; tone: Tone }> = {
  ai: { label: "AI Model", icon: Sparkles, tone: "purple" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "green" },
  email: { label: "Email", icon: Mail, tone: "blue" },
  webhook: { label: "Webhook", icon: Webhook, tone: "orange" },
};

type Item = {
  key: string;
  category: Category;
  title: string;
  description: string;
  connected: boolean;
  /** Ringkasan singkat (hanya untuk yang terhubung). */
  meta?: string | null;
  isDefault?: boolean;
  error?: boolean;
  /** Hubungkan (setup baru). */
  open: () => void;
  /** Kelola (detail + aksi) untuk yang sudah terhubung. */
  manage: () => void;
};

type Props = {
  connectors: ConnectorView[];
  canManage: boolean;
  webhook: WebhookView | null;
  outbound: React.ComponentProps<typeof OutboundWebhooksCard>["webhooks"];
  deliveries: React.ComponentProps<typeof OutboundWebhooksCard>["deliveries"];
};

/**
 * Connector Hub: tab "Tersedia" (katalog ala app store, grid 4) dan tab "Terhubung".
 * Semua kategori (AI, WhatsApp, Email, Webhook) digabung; klik kartu membuka form setup.
 */
export function ConnectorHub({ connectors, canManage, webhook, outbound, deliveries }: Props) {
  const [tab, setTab] = useState("available");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [aiLaunch, setAiLaunch] = useState<{ provider: AiProvider; n: number }>();
  const [emailLaunch, setEmailLaunch] = useState<{ provider: EmailProvider; n: number }>();
  const [waLaunch, setWaLaunch] = useState<{ provider: WaProvider; n: number }>();
  const [aiManage, setAiManage] = useState<{ provider: AiProvider; n: number }>();
  const [emailManage, setEmailManage] = useState<{ provider: EmailProvider; n: number }>();
  const [waManage, setWaManage] = useState<{ provider: WaProvider; n: number }>();
  const [webhookDlg, setWebhookDlg] = useState<"in" | "out" | null>(null);
  const by = new Map(connectors.map((c) => [c.type, c]));

  const items: Item[] = [
    ...AI_PROVIDERS.map((p) => {
      const c = by.get(AI_PROVIDER_INFO[p].type);
      return {
        key: `ai-${p}`,
        category: "ai" as const,
        title: AI_PROVIDER_INFO[p].title,
        description: AI_PROVIDER_INFO[p].description,
        connected: !!c,
        meta: c ? `${c.model ?? AI_PROVIDER_INFO[p].defaultModel} · ${c.maskedHint}` : undefined,
        isDefault: c?.isDefault,
        error: c?.status === "error",
        open: () => setAiLaunch({ provider: p, n: Date.now() }),
        manage: () => setAiManage({ provider: p, n: Date.now() }),
      };
    }),
    ...WA_PROVIDERS.map((p) => {
      const c = by.get(WA_PROVIDER_INFO[p].type);
      return {
        key: `wa-${p}`,
        category: "whatsapp" as const,
        title: WA_PROVIDER_INFO[p].title,
        description: WA_PROVIDER_INFO[p].description,
        connected: !!c,
        meta: c?.maskedHint,
        isDefault: c?.isDefault,
        error: c?.status === "error",
        open: () => setWaLaunch({ provider: p, n: Date.now() }),
        manage: () => setWaManage({ provider: p, n: Date.now() }),
      };
    }),
    ...EMAIL_PROVIDERS.map((p) => {
      const c = by.get(EMAIL_PROVIDER_INFO[p].type);
      const from = (c?.settings as { from?: string } | null)?.from;
      return {
        key: `email-${p}`,
        category: "email" as const,
        title: EMAIL_PROVIDER_INFO[p].title,
        description: EMAIL_PROVIDER_INFO[p].description,
        connected: !!c,
        meta: c ? [from, c.maskedHint].filter(Boolean).join(" · ") : undefined,
        isDefault: c?.isDefault,
        error: c?.status === "error",
        open: () => setEmailLaunch({ provider: p, n: Date.now() }),
        manage: () => setEmailManage({ provider: p, n: Date.now() }),
      };
    }),
    {
      key: "webhook-in",
      category: "webhook",
      title: "Webhook masuk",
      description: "Terima lead dari form website dan sistem lain lewat POST bertanda tangan.",
      connected: !!webhook,
      meta: webhook ? (webhook.isActive ? "Aktif" : "Nonaktif") : undefined,
      open: () => setWebhookDlg("in"),
      manage: () => setWebhookDlg("in"),
    },
    {
      key: "webhook-out",
      category: "webhook",
      title: "Zapier, Make & webhook keluar",
      description: "Kirim event CRM ke Zapier, Make, atau endpoint Anda sendiri.",
      connected: outbound.length > 0,
      meta: outbound.length > 0 ? `${outbound.length} webhook` : undefined,
      open: () => setWebhookDlg("out"),
      manage: () => setWebhookDlg("out"),
    },
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "all" || i.category === filter) &&
        (!q || `${i.title} ${i.description}`.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter, connectors, webhook, outbound]);
  const connectedItems = items.filter((i) => i.connected);

  const connectedCount = connectedItems.length;

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <TabsList variant="segment">
        <TabsTrigger value="available">Tersedia</TabsTrigger>
        <TabsTrigger value="connected">
          Terhubung{connectedCount > 0 && ` (${connectedCount})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="available" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Cari connector"
              placeholder="Cari connector…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "ai", "whatsapp", "email", "webhook"] as const).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={filter === c ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter(c)}
              >
                {c === "all" ? "Semua" : CATEGORY[c].label}
              </Button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Tidak ada connector yang cocok.
          </p>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" data-testid="connector-grid">
            {visible.map((i) => (
              <ConnectorCard key={i.key} item={i} canManage={canManage} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="connected" className="space-y-4">
        {connectedItems.length === 0 ? (
          <Card className="p-card items-center gap-2 py-10 text-center">
            <Cable className="text-muted-foreground size-8" />
            <p className="font-semibold">Belum ada connector terhubung</p>
            <p className="text-muted-foreground text-xs">
              Buka tab Tersedia, pilih connector, lalu hubungkan.
            </p>
            <Button variant="outline" onClick={() => setTab("available")}>
              Lihat connector tersedia
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" data-testid="connected-grid">
            {connectedItems.map((i) => (
              <ConnectorCard key={i.key} item={i} canManage={canManage} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* Form setup & dialog kelola selalu ter-mount agar bisa dibuka dari tab mana pun. */}
      <AiConnectorList
        connectors={connectors}
        canManage={canManage}
        launch={aiLaunch}
        manage={aiManage}
      />
      <WhatsappConnectorList
        connectors={connectors}
        canManage={canManage}
        launch={waLaunch}
        manage={waManage}
      />
      <EmailConnectorList
        connectors={connectors}
        canManage={canManage}
        launch={emailLaunch}
        manage={emailManage}
      />
      <Dialog open={webhookDlg !== null} onOpenChange={(o) => !o && setWebhookDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {webhookDlg === "in" ? "Webhook masuk" : "Zapier, Make & webhook keluar"}
            </DialogTitle>
            <DialogDescription>Kelola pengaturan, secret, dan log pengiriman.</DialogDescription>
          </DialogHeader>
          {webhookDlg === "in" && <WebhookCard webhook={webhook} canManage={canManage} />}
          {webhookDlg === "out" && (
            <div className="space-y-4">
              <OutboundWebhooksCard
                webhooks={outbound}
                deliveries={deliveries}
                canManage={canManage}
              />
              <EventCatalog />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

/** Kartu gaya app store; dipakai di tab Tersedia dan Terhubung. */
function ConnectorCard({ item: i, canManage }: { item: Item; canManage: boolean }) {
  const cat = CATEGORY[i.category];
  return (
    <Card data-testid={`catalog-${i.key}`} className="p-card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <IconTile icon={cat.icon} tone={cat.tone} />
        <div className="min-w-0">
          <h4 className="text-md truncate leading-tight font-semibold">{i.title}</h4>
          <p className="text-muted-foreground text-xs">{cat.label}</p>
        </div>
      </div>
      <p className="text-muted-foreground line-clamp-3 flex-1 text-xs">
        {i.connected && i.meta ? <span className="font-mono">{i.meta}</span> : i.description}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {i.connected &&
            (i.error ? (
              <Badge variant="destructive">Error</Badge>
            ) : (
              <Badge variant="secondary">Terhubung</Badge>
            ))}
          {i.isDefault && <Badge>Default</Badge>}
        </div>
        {(canManage || i.connected) && (
          <Button
            size="sm"
            variant={i.connected ? "outline" : "default"}
            className="rounded-full"
            onClick={i.connected ? i.manage : i.open}
            disabled={!i.connected && !canManage}
          >
            {i.connected ? "Kelola" : "Hubungkan"}
          </Button>
        )}
      </div>
    </Card>
  );
}
