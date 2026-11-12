"use client";

import { aiDraftQuotationNarrative } from "@/modules/quotations/server/ai-actions";
import { Download, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_CODES, formatMoney, formatNumber } from "@/lib/money";
import {
  calculateQuotation,
  QUOTATION_DISCLAIMER,
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_TRANSITIONS,
  type QuotationStatus,
} from "@/modules/quotations/calc";
import {
  deleteQuotation,
  saveQuotation,
  setQuotationStatus,
} from "@/modules/quotations/server/actions";
import type { QuotationDetail } from "@/modules/quotations/server/queries";

type Opt = { id: string; name: string };
type Line = {
  key: number;
  productId?: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
};
export type CatalogProduct = { id: string; name: string; price: string; currency: string };

const TRANSITION_LABEL: Record<QuotationStatus, string> = {
  draft: "Kembalikan ke Draft",
  sent: "Tandai terkirim",
  accepted: "Diterima",
  rejected: "Ditolak",
  expired: "Tandai kedaluwarsa",
};

/** Builder quotation. Pratinjau total memakai fungsi hitung yang sama dengan server; server tetap menghitung ulang saat simpan. */
export function QuotationBuilder({
  q,
  products,
  contacts,
  companies,
  canEdit,
  canDelete,
}: {
  q: QuotationDetail;
  products: CatalogProduct[];
  contacts: Opt[];
  companies: Opt[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const editable = canEdit && q.status === "draft" && q.approvalStatus !== "pending";
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(q.title);
  const [validUntil, setValidUntil] = useState<string>(q.validUntil);
  const [currency, setCurrency] = useState(q.currency);
  const [contactId, setContactId] = useState(q.contactId ?? "");
  const [companyId, setCompanyId] = useState(q.companyId ?? "");
  const [notes, setNotes] = useState(q.notes ?? "");
  const [terms, setTerms] = useState(q.terms ?? "");
  const [narrative, setNarrative] = useState(q.narrative ?? "");
  const [guidance, setGuidance] = useState("");
  const [aiDraft, setAiDraft] = useState<{ draft: string; warnings: string[] } | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState<string>(q.globalDiscountPercent);
  const [seq, setSeq] = useState(q.items.length);
  const [lines, setLines] = useState<Line[]>(
    q.items.map((i, k) => ({
      key: k,
      productId: i.productId ?? undefined,
      name: i.name,
      description: i.description ?? "",
      quantity: String(Number(i.quantity)),
      unitPrice: i.unitPrice,
      discountPercent: String(Number(i.discountPercent)),
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pick, setPick] = useState("");

  const calc = useMemo(() => {
    try {
      return calculateQuotation(
        lines.map((l) => ({
          quantity: l.quantity || "0",
          unitPrice: l.unitPrice || "0",
          discountPercent: l.discountPercent || "0",
        })),
        {
          taxRate: q.taxRate,
          taxInclusive: q.taxInclusive,
          globalDiscountPercent: globalDiscount || "0",
        },
      );
    } catch {
      return null;
    }
  }, [lines, q.taxRate, q.taxInclusive, globalDiscount]);

  const set = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (l?: Partial<Line>) => {
    setLines((ls) => [
      ...ls,
      {
        key: seq,
        name: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        discountPercent: "0",
        ...l,
      },
    ]);
    setSeq((n) => n + 1);
  };

  function save() {
    start(async () => {
      const res = await saveQuotation({
        id: q.id,
        title,
        validUntil,
        currency: currency as never,
        contactId,
        companyId,
        notes,
        terms,
        narrative,
        globalDiscountPercent: globalDiscount,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
        })),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
      }
      setErrors({});
      toast.success("Quotation disimpan");
      router.refresh();
    });
  }

  const status = q.status as QuotationStatus;
  const next = STATUS_TRANSITIONS[status] ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{q.number}</CardTitle>
              <ToneBadge tone={STATUS_TONE[status] ?? "blue"}>
                {STATUS_LABEL[status] ?? status}
              </ToneBadge>
            </div>
            <p className="text-muted-foreground text-xs">
              {q.deal ? (
                <>
                  Deal:{" "}
                  <a className="text-primary hover:underline" href={`/deals/${q.deal.id}`}>
                    {q.deal.title}
                  </a>
                </>
              ) : (
                "Tanpa deal"
              )}
              {" · "}Pajak {q.taxLabel} {formatNumber(q.taxRate)}%{" "}
              {q.taxInclusive ? "(termasuk)" : "(eksklusif)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/api/quotations/${q.id}/pdf`} download>
                <Download /> Unduh PDF
              </a>
            </Button>
            {canEdit &&
              next.map((s) => (
                <Button
                  key={s}
                  variant={s === "sent" || s === "accepted" ? "default" : "outline"}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await setQuotationStatus({ id: q.id, status: s });
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success(`Status: ${STATUS_LABEL[s]}`);
                        router.refresh();
                      }
                    })
                  }
                >
                  {TRANSITION_LABEL[s]}
                </Button>
              ))}
            {canDelete && q.status === "draft" && (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteQuotation({ id: q.id });
                    if (!res.ok) toast.error(res.error);
                    else router.push("/quotations");
                  })
                }
              >
                <Trash2 /> Hapus
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="qb-title" label="Judul" error={errors.title}>
            <Input
              id="qb-title"
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField id="qb-valid" label="Berlaku sampai" error={errors.validUntil}>
            <Input
              id="qb-valid"
              type="date"
              value={validUntil}
              disabled={!editable}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </FormField>
          <FormField id="qb-contact" label="Contact">
            <SelectField
              id="qb-contact"
              value={contactId}
              onChange={setContactId}
              noneLabel="—"
              disabled={!editable}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
          </FormField>
          <FormField id="qb-company" label="Company">
            <SelectField
              id="qb-company"
              value={companyId}
              onChange={setCompanyId}
              noneLabel="—"
              disabled={!editable}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
          </FormField>
          <FormField id="qb-currency" label="Mata uang">
            <SelectField
              id="qb-currency"
              value={currency}
              onChange={setCurrency}
              disabled={!editable}
              options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
            />
          </FormField>
          <FormField id="qb-gdisc" label="Diskon global (%)" error={errors.globalDiscountPercent}>
            <NumberInput
              id="qb-gdisc"
              value={globalDiscount}
              disabled={!editable}
              onValueChange={setGlobalDiscount}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3" data-testid="quotation-lines">
            {lines.map((l, i) => (
              <div
                key={l.key}
                className="grid items-start gap-2 sm:grid-cols-[1fr_5rem_9rem_5rem_auto]"
              >
                <div className="space-y-1">
                  <Input
                    aria-label={`Nama item ${i + 1}`}
                    value={l.name}
                    disabled={!editable}
                    onChange={(e) => set(l.key, { name: e.target.value })}
                  />
                  {errors[`items.${i}.name`] && (
                    <p role="alert" className="text-tone-red-ink text-xs">
                      {errors[`items.${i}.name`]}
                    </p>
                  )}
                </div>
                <NumberInput
                  aria-label={`Jumlah ${i + 1}`}
                  value={l.quantity}
                  disabled={!editable}
                  onValueChange={(v) => set(l.key, { quantity: v })}
                />
                <NumberInput
                  aria-label={`Harga satuan ${i + 1}`}
                  value={l.unitPrice}
                  disabled={!editable}
                  onValueChange={(v) => set(l.key, { unitPrice: v })}
                />
                <NumberInput
                  aria-label={`Diskon % ${i + 1}`}
                  value={l.discountPercent}
                  disabled={!editable}
                  onValueChange={(v) => set(l.key, { discountPercent: v })}
                />
                {editable && (
                  <Button
                    type="button"
                    variant="destructive"
                    aria-label={`Hapus item ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 /> Hapus
                  </Button>
                )}
                <p className="text-muted-foreground text-xs tabular-nums sm:col-span-5">
                  Total baris: {calc?.lines[i] ? formatMoney(calc.lines[i].net, currency) : "—"}
                </p>
              </div>
            ))}
          </div>
          {editable && (
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
              <SelectField
                id="qb-pick"
                value={pick}
                onChange={setPick}
                placeholder="Tambah dari katalog…"
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} — ${formatMoney(p.price, p.currency)}`,
                }))}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!pick}
                onClick={() => {
                  const p = products.find((x) => x.id === pick);
                  if (p) addLine({ productId: p.id, name: p.name, unitPrice: p.price });
                  setPick("");
                }}
              >
                <Plus /> Dari katalog
              </Button>
              <Button type="button" variant="outline" onClick={() => addLine()}>
                <Plus /> Item kustom
              </Button>
            </div>
          )}
          {errors.items && (
            <p role="alert" className="text-tone-red-ink text-xs">
              {errors.items}
            </p>
          )}
          <dl
            className="ml-auto w-full max-w-xs space-y-1 text-sm tabular-nums"
            data-testid="quotation-totals"
          >
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{calc ? formatMoney(calc.subtotal, currency) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Diskon</dt>
              <dd>{calc ? `-${formatMoney(calc.discountTotal, currency)}` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>
                {q.taxLabel} {formatNumber(q.taxRate)}%{q.taxInclusive ? " (termasuk)" : ""}
              </dt>
              <dd>{calc ? formatMoney(calc.taxTotal, currency) : "—"}</dd>
            </div>
            <div className="border-border flex justify-between border-t pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd data-testid="grand-total">
                {calc ? formatMoney(calc.total, currency) : "Input tidak valid"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Narasi pengantar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormField
            id="qb-narrative"
            label="Pengantar / ruang lingkup (tampil di PDF)"
            hint="Bisa ditulis sendiri atau dari draf AI. Angka harga tidak pernah dibuat AI — hanya tabel di atas."
          >
            <Textarea
              id="qb-narrative"
              rows={6}
              value={narrative}
              disabled={!editable}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </FormField>
          {editable && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1">
                  <Input
                    aria-label="Arahan untuk AI"
                    placeholder="Arahan opsional (mis. nada formal, tekankan implementasi)"
                    maxLength={300}
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await aiDraftQuotationNarrative({
                        quotationId: q.id,
                        guidance: guidance || undefined,
                      });
                      if (!res.ok) return void toast.error(res.error);
                      setAiDraft(res.data);
                    })
                  }
                >
                  <Sparkles /> Buat draf dengan AI
                </Button>
              </div>
              {aiDraft && (
                <div
                  className="space-y-2 rounded-lg border border-dashed p-3"
                  data-testid="ai-narrative-draft"
                >
                  <p className="text-xs font-semibold">Draf AI — tinjau dan edit sebelum dipakai</p>
                  <Textarea
                    aria-label="Draf narasi AI"
                    rows={6}
                    value={aiDraft.draft}
                    onChange={(e) => setAiDraft({ ...aiDraft, draft: e.target.value })}
                  />
                  {aiDraft.warnings.map((w) => (
                    <p key={w} role="alert" className="text-tone-orange-ink text-xs">
                      ⚠ {w}
                    </p>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setNarrative(aiDraft.draft);
                        setAiDraft(null);
                        toast.success("Draf dimasukkan. Klik Simpan untuk menyimpan.");
                      }}
                    >
                      Pakai draf ini
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAiDraft(null)}
                    >
                      Buang
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catatan & syarat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="qb-notes" label="Catatan untuk pelanggan">
            <Textarea
              id="qb-notes"
              rows={4}
              value={notes}
              disabled={!editable}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          <FormField id="qb-terms" label="Syarat & ketentuan">
            <Textarea
              id="qb-terms"
              rows={4}
              value={terms}
              disabled={!editable}
              onChange={(e) => setTerms(e.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      {editable && (
        <Button onClick={save} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      )}
      <p className="text-muted-foreground text-xs">{QUOTATION_DISCLAIMER}</p>
    </div>
  );
}
