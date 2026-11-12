import { describe, expect, it } from "vitest";
import { OUTBOUND_EVENTS, OUTBOUND_SCHEMA_VERSION } from "@/modules/integrations/constants";
import {
  CATALOG_EVENTS,
  EVENT_CATALOG,
  EVENT_SCHEMAS,
  validateEventData,
} from "@/modules/integrations/events";
import {
  contactPayload,
  customerPayload,
  dealPayload,
  leadConvertedPayload,
  leadPayload,
  productPayload,
  quotationPayload,
  stageChangePayload,
} from "@/modules/integrations/payloads";

const lead = {
  id: "l1",
  name: "Budi",
  email: "b@x.co",
  phone: null,
  companyName: null,
  status: "qualified",
  sourceId: null,
  ownerId: "u1",
  budget: "1000.5",
  currency: "IDR",
  createdAt: new Date("2026-11-12T00:00:00Z"),
};
const deal = {
  id: "d1",
  title: "Deal",
  status: "won",
  value: { toFixed: (n: number) => (2500).toFixed(n) },
  currency: "IDR",
  stageId: "s1",
  contactId: null,
  companyId: "c1",
  ownerId: null,
  closedAt: new Date("2026-11-12T00:00:00Z"),
};

describe("katalog event & skema payload ber-versi", () => {
  it("setiap event punya entri katalog dan skema; versi skema terdefinisi", () => {
    expect([...CATALOG_EVENTS].sort()).toEqual([...OUTBOUND_EVENTS].sort());
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual([...OUTBOUND_EVENTS].sort());
    expect(OUTBOUND_SCHEMA_VERSION).toBe("1");
    for (const e of EVENT_CATALOG) {
      expect(e.description.length).toBeGreaterThan(10);
      expect(e.fields.length).toBeGreaterThan(0);
    }
  });

  it("payload dari builder resmi lolos skema (kontrak) untuk semua event", () => {
    const quo = {
      id: "q1",
      number: "QUO-2026-0001",
      status: "accepted",
      total: "1110000.00",
      currency: "IDR",
      validUntil: new Date("2026-12-31T00:00:00Z"),
      dealId: null,
      contactId: null,
      companyId: "c1",
      ownerId: null,
    };
    const prod = {
      id: "p1",
      name: "Produk",
      sku: "SKU-1",
      price: "9999.00",
      currency: "IDR",
      isActive: true,
      categoryId: null,
    };
    const samples: Record<string, unknown> = {
      "lead.created": leadPayload(lead),
      "lead.converted": leadConvertedPayload(lead, {
        contactId: "c",
        companyId: null,
        dealId: "d",
      }),
      "contact.created": contactPayload({
        id: "c1",
        name: "Siti",
        email: null,
        phone: null,
        jobTitle: null,
        ownerId: null,
        createdAt: new Date(),
      }),
      "deal.created": dealPayload({ ...deal, status: "open", closedAt: null }),
      "deal.stage_changed": stageChangePayload(deal, "s0", "s1"),
      "deal.won": dealPayload(deal),
      "deal.lost": dealPayload({ ...deal, status: "lost", lostCategory: "Harga" }),
      "customer.created": customerPayload({
        partyType: "company",
        partyId: "c1",
        dealId: "d1",
        value: "2500.00",
        currency: "IDR",
        wonAt: new Date(),
      }),
      "quotation.sent": quotationPayload({ ...quo, status: "sent" }),
      "quotation.accepted": quotationPayload(quo),
      "quotation.rejected": quotationPayload({ ...quo, status: "rejected" }),
      "product.created": productPayload(prod),
      "product.updated": productPayload({ ...prod, isActive: false }),
    };
    for (const ev of OUTBOUND_EVENTS) {
      const r = validateEventData(ev, samples[ev]);
      expect(r.success, `${ev}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("payload yang melanggar kontrak ditolak (field hilang, uang bukan string desimal, tanggal tidak ISO)", () => {
    expect(validateEventData("lead.created", { id: "1" }).success).toBe(false);
    expect(validateEventData("deal.won", { ...dealPayload(deal), value: "2.500,00" }).success).toBe(
      false,
    );
    expect(
      validateEventData("customer.created", {
        partyType: "company",
        partyId: "c",
        firstDealId: "d",
        firstDealValue: "1.00",
        currency: "IDR",
        wonAt: "kemarin",
      }).success,
    ).toBe(false);
    expect(
      validateEventData("deal.won", { ...dealPayload(deal), status: "archived" }).success,
    ).toBe(false);
  });

  it("tidak membocorkan field internal: skema tidak punya notes/lostReason bebas", () => {
    const keys = JSON.stringify(dealPayload(deal));
    expect(keys).not.toMatch(/notes|lostReason/);
    expect(JSON.stringify(leadPayload(lead))).not.toMatch(/notes/);
  });
});
