import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiConnectorList } from "@/modules/connectors/components/ai-connector-list";
import { FUTURE_CONNECTORS } from "@/modules/connectors/registry";
import type { ConnectorView } from "@/modules/connectors/server/queries";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-panel-title font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function ConnectorHub({
  connectors,
  canManage,
  extra,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
  /** Kartu tambahan per kategori (webhook, email) dari plan berikutnya. */
  extra?: {
    webhook?: React.ReactNode;
    email?: React.ReactNode;
    whatsapp?: React.ReactNode;
    outbound?: React.ReactNode;
  };
}) {
  return (
    <div className="space-y-6">
      <AiConnectorList connectors={connectors} canManage={canManage} />
      <Section
        title="Inbound Webhooks"
        description="Terima lead dari form website dan sistem lain."
      >
        {extra?.webhook ?? <SoonCard title="Webhook masuk" note="Segera tersedia" />}
      </Section>
      {extra?.email ?? (
        <Section
          title="Email Delivery"
          description="Kirim email transaksional (undangan, reset password, reminder)."
        >
          <SoonCard title="Email delivery" note="Segera tersedia" />
        </Section>
      )}
      {extra?.outbound}
      {extra?.whatsapp ?? (
        <Section title="WhatsApp" description="Percakapan pelanggan melalui WhatsApp Business.">
          {FUTURE_CONNECTORS.filter((c) => c.category === "whatsapp").map((c) => (
            <SoonCard key={c.title} title={c.title} description={c.description} note={c.note} />
          ))}
        </Section>
      )}
    </div>
  );
}

function SoonCard({
  title,
  description,
  note,
}: {
  title: string;
  description?: string;
  note: string;
}) {
  return (
    <Card className="p-card gap-2 opacity-70">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-md font-semibold">{title}</h4>
        <Badge variant="outline">{note}</Badge>
      </div>
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </Card>
  );
}
