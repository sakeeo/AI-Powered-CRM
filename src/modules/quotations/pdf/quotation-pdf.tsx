import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { QUOTATION_DISCLAIMER } from "@/modules/quotations/calc";
import type { QuotationDetail } from "@/modules/quotations/server/queries";

const fmt = (v: string, cur: string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2,
  }).format(Number(v));
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2933" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#6b7280" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  block: { marginTop: 14 },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#eef2f7", padding: 5 },
  td: { padding: 5, borderBottom: "1 solid #e5e7eb" },
  right: { textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 230 },
  grand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    borderTop: "1 solid #1f2933",
    paddingTop: 4,
    marginTop: 2,
  },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#6b7280" },
});

const COLS = { name: "42%", qty: "10%", price: "18%", disc: "10%", total: "20%" } as const;

export function QuotationPdf({
  q,
  organizationName,
}: {
  q: QuotationDetail;
  organizationName: string;
}) {
  const customer = [q.contact?.name, q.company?.name].filter(Boolean).join(" · ");
  return (
    <Document title={`${q.number} — ${q.title}`} author={organizationName}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View>
            <Text style={s.h1}>PENAWARAN HARGA</Text>
            <Text style={s.muted}>{organizationName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{q.number}</Text>
            <Text style={s.muted}>Tanggal: {day(q.issueDate)}</Text>
            <Text style={s.muted}>Berlaku s.d.: {day(q.validUntil)}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.muted}>Kepada</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{customer || "—"}</Text>
          <Text style={{ marginTop: 6 }}>{q.title}</Text>
        </View>

        <View style={s.block}>
          <View style={s.row}>
            <Text style={[s.th, { width: COLS.name }]}>Item</Text>
            <Text style={[s.th, s.right, { width: COLS.qty }]}>Jml</Text>
            <Text style={[s.th, s.right, { width: COLS.price }]}>Harga</Text>
            <Text style={[s.th, s.right, { width: COLS.disc }]}>Diskon</Text>
            <Text style={[s.th, s.right, { width: COLS.total }]}>Total</Text>
          </View>
          {q.items.map((i) => (
            <View key={i.id} style={s.row} wrap={false}>
              <View style={[s.td, { width: COLS.name }]}>
                <Text>{i.name}</Text>
                {i.description ? <Text style={s.muted}>{i.description}</Text> : null}
              </View>
              <Text style={[s.td, s.right, { width: COLS.qty }]}>{Number(i.quantity)}</Text>
              <Text style={[s.td, s.right, { width: COLS.price }]}>
                {fmt(i.unitPrice, q.currency)}
              </Text>
              <Text style={[s.td, s.right, { width: COLS.disc }]}>
                {Number(i.discountPercent) ? `${Number(i.discountPercent)}%` : "—"}
              </Text>
              <Text style={[s.td, s.right, { width: COLS.total }]}>
                {fmt(i.lineTotal, q.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.between}>
            <Text>Subtotal</Text>
            <Text>{fmt(q.subtotal, q.currency)}</Text>
          </View>
          <View style={s.between}>
            <Text>Diskon</Text>
            <Text>-{fmt(q.discountTotal, q.currency)}</Text>
          </View>
          <View style={s.between}>
            <Text>
              {q.taxLabel} {Number(q.taxRate)}%{q.taxInclusive ? " (termasuk)" : ""}
            </Text>
            <Text>{fmt(q.taxTotal, q.currency)}</Text>
          </View>
          <View style={[s.between, s.grand]}>
            <Text>Total</Text>
            <Text>{fmt(q.total, q.currency)}</Text>
          </View>
        </View>

        {q.narrative ? (
          <View style={s.block}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Pengantar</Text>
            <Text>{q.narrative}</Text>
          </View>
        ) : null}
        {q.notes ? (
          <View style={s.block}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Catatan</Text>
            <Text>{q.notes}</Text>
          </View>
        ) : null}
        {q.terms ? (
          <View style={s.block}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Syarat & ketentuan</Text>
            <Text>{q.terms}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {QUOTATION_DISCLAIMER}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(
  q: QuotationDetail,
  organizationName: string,
): Promise<Buffer> {
  return renderToBuffer(<QuotationPdf q={q} organizationName={organizationName} />);
}
