"use client";

import { History, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { APPROVAL_LABEL, type ApprovalStatus } from "@/modules/quotations/approval";
import {
  cancelQuotationApproval,
  decideQuotationApproval,
  requestQuotationApproval,
} from "@/modules/quotations/server/approval-actions";
import {
  compareQuotationVersions,
  restoreQuotationVersion,
} from "@/modules/quotations/server/version-actions";
import type { SnapshotDiff } from "@/modules/quotations/versioning";

const TONE = { none: "blue", pending: "orange", approved: "green", rejected: "red" } as const;

/** Kartu persetujuan: ajukan / tarik / setujui / tolak. Tampil hanya bila quotation memerlukan approval atau sudah punya status. */
export function ApprovalCard({
  id,
  status,
  required,
  threshold,
  currency,
  note,
  isDraft,
  canRequest,
  canDecide,
  canCancel,
}: {
  id: string;
  status: ApprovalStatus;
  required: boolean;
  threshold: string | null;
  currency: string;
  note: string | null;
  isDraft: boolean;
  canRequest: boolean;
  canDecide: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!required && status === "none") return null;
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Gagal");
      else {
        toast.success(ok);
        setReason("");
        router.refresh();
      }
    });
  return (
    <Card data-testid="approval-card">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Persetujuan <ToneBadge tone={TONE[status]}>{APPROVAL_LABEL[status]}</ToneBadge>
          </CardTitle>
          <CardDescription>
            {threshold
              ? `Quotation dengan total ≥ ${formatMoney(threshold, currency)} perlu disetujui sebelum dikirim.`
              : "Persetujuan diperlukan sebelum dikirim."}
            {" Mengubah isi setelah disetujui membatalkan persetujuan."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {note && <p className="text-sm">Catatan: {note}</p>}
        {isDraft && canRequest && status !== "pending" && status !== "approved" && (
          <Button
            disabled={pending}
            onClick={() => act(() => requestQuotationApproval({ id }), "Diajukan")}
          >
            Ajukan persetujuan
          </Button>
        )}
        {status === "pending" && canCancel && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => act(() => cancelQuotationApproval({ id }), "Pengajuan ditarik")}
          >
            Tarik pengajuan
          </Button>
        )}
        {status === "pending" && canDecide && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Input
                aria-label="Catatan keputusan"
                placeholder="Catatan (wajib bila menolak)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                act(
                  () =>
                    decideQuotationApproval({
                      id,
                      decision: "approved",
                      note: reason || undefined,
                    }),
                  "Disetujui",
                )
              }
            >
              Setujui
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                act(
                  () => decideQuotationApproval({ id, decision: "rejected", note: reason }),
                  "Ditolak",
                )
              }
            >
              Tolak
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type VersionRow = {
  id: string;
  version: number;
  label: string;
  total: string;
  createdAt: Date;
};

/** Riwayat versi: bandingkan dua versi dan pulihkan (Draft). */
export function HistoryCard({
  id,
  versions,
  currency,
  canRestore,
}: {
  id: string;
  versions: VersionRow[];
  currency: string;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(versions[1] ? String(versions[1].version) : "");
  const [to, setTo] = useState(versions[0] ? String(versions[0].version) : "");
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [pending, start] = useTransition();
  if (versions.length === 0) return null;
  const opts = versions.map((v) => ({
    value: String(v.version),
    label: `v${v.version} · ${v.label} · ${formatMoney(v.total, currency)}`,
  }));
  return (
    <Card data-testid="history-card">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" /> Riwayat versi
          </CardTitle>
          <CardDescription>
            Setiap penyimpanan yang mengubah isi dan setiap pengiriman tercatat sebagai versi.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <strong>v{v.version}</strong> · {v.label} · {formatMoney(v.total, currency)}
                <span className="text-muted-foreground ml-2 text-xs">
                  {new Date(v.createdAt).toLocaleString("id-ID")}
                </span>
              </span>
              {canRestore && (
                <RowAction
                  icon={RotateCcw}
                  label="Pulihkan"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await restoreQuotationVersion({ id, version: v.version });
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success(`Dipulihkan dari v${v.version}`);
                        router.refresh();
                      }
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
        {versions.length > 1 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-64">
                <SelectField
                  id="ver-from"
                  value={from}
                  onChange={setFrom}
                  options={opts}
                  placeholder="Versi awal"
                />
              </div>
              <span className="pb-2 text-sm">→</span>
              <div className="w-64">
                <SelectField
                  id="ver-to"
                  value={to}
                  onChange={setTo}
                  options={opts}
                  placeholder="Versi akhir"
                />
              </div>
              <Button
                variant="outline"
                disabled={pending || !from || !to}
                onClick={() =>
                  start(async () => {
                    const r = await compareQuotationVersions({
                      id,
                      from: Number(from),
                      to: Number(to),
                    });
                    if (!r.ok) return void toast.error(r.error);
                    setDiff(r.data);
                  })
                }
              >
                Bandingkan
              </Button>
            </div>
            {diff && (
              <div className="space-y-2 text-sm" data-testid="version-diff">
                {diff.identical ? (
                  <p className="text-muted-foreground">Kedua versi identik.</p>
                ) : (
                  <>
                    <p>
                      Selisih total:{" "}
                      <strong className="tabular-nums">
                        {Number(diff.totalDelta) > 0 ? "+" : ""}
                        {formatMoney(diff.totalDelta, currency)}
                      </strong>
                    </p>
                    <ul className="space-y-1">
                      {diff.header.map((h) => (
                        <li key={h.field}>
                          <strong>{h.field}:</strong>{" "}
                          <span className="text-muted-foreground line-through">{h.from}</span> →{" "}
                          {h.to}
                        </li>
                      ))}
                      {diff.items.map((i, k) =>
                        i.kind === "changed" ? (
                          <li key={k}>
                            <ToneBadge tone="orange">Diubah</ToneBadge> <strong>{i.name}</strong>:{" "}
                            {i.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join("; ")}
                          </li>
                        ) : (
                          <li key={k}>
                            <ToneBadge tone={i.kind === "added" ? "green" : "red"}>
                              {i.kind === "added" ? "Ditambah" : "Dihapus"}
                            </ToneBadge>{" "}
                            <strong>{i.name}</strong>
                          </li>
                        ),
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
