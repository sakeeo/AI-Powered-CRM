import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EVENT_CATALOG,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  SCHEMA_VERSION,
} from "@/modules/integrations/events";

/** Katalog event bisnis & skema payload ber-versi untuk integrator ERP/POS/akuntansi. */
export function EventCatalog() {
  return (
    <Card data-testid="event-catalog">
      <CardHeader>
        <div>
          <CardTitle>Katalog event & skema payload</CardTitle>
          <CardDescription>
            Semua event memakai amplop{" "}
            <code>{"{ id, event, schemaVersion, createdAt, data }"}</code> (skema versi{" "}
            <strong>{SCHEMA_VERSION}</strong>). Uang berupa string desimal, tanggal ISO 8601. Tanda
            tangan: header <code>X-CRM-Signature</code> (HMAC-SHA256 atas{" "}
            <code>timestamp.body</code>) dan <code>X-CRM-Timestamp</code>; retry exponential, lalu
            dead-letter yang dapat dikirim ulang.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {EVENT_CATEGORIES.map((cat) => (
          <div key={cat} className="space-y-1.5">
            <h4 className="text-sm font-semibold">{EVENT_CATEGORY_LABEL[cat]}</h4>
            <ul className="divide-y rounded-lg border text-xs">
              {EVENT_CATALOG.filter((e) => e.category === cat).map((e) => (
                <li key={e.event} className="space-y-1 px-3 py-2">
                  <p>
                    <code className="font-semibold">{e.event}</code>
                    <span className="text-muted-foreground"> — {e.description}</span>
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">data:</span> {e.fields.join(", ")}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Contoh pakai:</span> {e.useCase}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
