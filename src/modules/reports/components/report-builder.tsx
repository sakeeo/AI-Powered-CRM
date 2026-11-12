"use client";

import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Play,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTIVITY_TYPE_VALUES,
  ENTITY_LABEL,
  FILTER_FIELDS,
  GROUP_FIELDS,
  INSIGHT_ENTITIES,
  PERIOD_FIELDS,
  PERIOD_LABEL,
  PERIOD_PRESETS,
  STATUS_VALUES,
  SUM_FIELDS,
  type InsightEntity,
  type InsightPlan,
} from "@/modules/insights/plan";
import type { InsightResult } from "@/modules/insights/server/execute";
import { ReportChart } from "@/modules/reports/components/report-chart";
import {
  FREQUENCY_LABEL,
  REPORT_FREQUENCIES,
  WEEKDAY_LABEL,
} from "@/modules/reports/saved-schemas";
import {
  deleteCustomReport,
  runCustomReport,
  saveCustomReport,
  scheduleCustomReport,
} from "@/modules/reports/server/saved-actions";
import type { SavedReportDto } from "@/modules/reports/server/saved-queries";

type Options = {
  owners: { userId: string; name: string }[];
  stages: string[];
  sources: string[];
};
type Owner = { userId: string; name: string };

const FIELD_LABEL: Record<string, string> = {
  status: "Status",
  source: "Sumber",
  owner: "Owner",
  stage: "Stage",
  type: "Tipe",
  month: "Bulan",
  createdAt: "Tanggal dibuat",
  closedAt: "Tanggal ditutup",
  expectedCloseDate: "Perkiraan closing",
  dueAt: "Tenggat",
  validUntil: "Berlaku sampai",
};
const METRIC_LABEL = { count: "Jumlah", sum: "Total nilai", list: "Daftar terbaru" } as const;
const lbl = (f: string) => FIELD_LABEL[f] ?? f;

const blank = (): InsightPlan => ({
  entity: "lead",
  metric: "count",
  filters: [],
  period: { field: "createdAt", preset: "this_month" },
  groupBy: null,
  limit: 10,
});

function valueOptions(field: string, entity: InsightEntity, o: Options) {
  if (field === "status") return STATUS_VALUES[entity].map((v) => ({ value: v, label: v }));
  if (field === "type") return ACTIVITY_TYPE_VALUES.map((v) => ({ value: v, label: v }));
  if (field === "owner")
    return [
      { value: "me", label: "Saya" },
      ...o.owners.map((x) => ({ value: x.name, label: x.name })),
    ];
  if (field === "stage") return o.stages.map((v) => ({ value: v, label: v }));
  if (field === "source") return o.sources.map((v) => ({ value: v, label: v }));
  return [];
}

function ResultTable({ r }: { r: InsightResult }) {
  const chartable =
    r.columns.length === 2 &&
    r.rows.length > 0 &&
    r.rows.every((row) => typeof row[1] === "number");
  return (
    <div className="space-y-3" data-testid="builder-result">
      <p className="text-muted-foreground text-xs">{r.summary}</p>
      {chartable && (
        <ReportChart
          spec={{
            title: r.title,
            kind: "bar",
            xKey: "name",
            series: [{ key: "nilai", name: r.columns[1] }],
            data: r.rows.map((row) => ({ name: String(row[0]), nilai: Number(row[1]) })),
          }}
        />
      )}
      {r.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tidak ada data yang cocok.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {r.columns.map((c) => (
                  <TableHead key={c} className="text-xs">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((c, j) => (
                    <TableCell
                      key={j}
                      className={typeof c === "number" ? "tabular-nums" : undefined}
                    >
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ScheduleDialog({
  report,
  owners,
  onClose,
}: {
  report: SavedReportDto;
  owners: Owner[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    frequency: report.frequency as (typeof REPORT_FREQUENCIES)[number],
    weekday: report.weekday ?? 1,
    monthday: report.monthday ?? 1,
    hour: report.hour,
    recipientIds: report.recipientIds,
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await scheduleCustomReport({ id: report.id, ...f });
              if (!res.ok)
                return void setError(Object.values(res.fieldErrors ?? {})[0] ?? res.error);
              toast.success(f.frequency === "none" ? "Jadwal dimatikan" : "Jadwal disimpan");
              onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Jadwal pengiriman — {report.name}</DialogTitle>
            <DialogDescription>
              Laporan dikirim lewat email ke anggota yang dipilih. Setiap penerima hanya menerima
              data yang boleh ia lihat.
            </DialogDescription>
          </DialogHeader>
          <FormField id="sch-freq" label="Frekuensi">
            <SelectField
              id="sch-freq"
              value={f.frequency}
              onChange={(v) => setF({ ...f, frequency: v as typeof f.frequency })}
              options={REPORT_FREQUENCIES.map((x) => ({ value: x, label: FREQUENCY_LABEL[x] }))}
            />
          </FormField>
          {f.frequency === "weekly" && (
            <FormField id="sch-day" label="Hari">
              <SelectField
                id="sch-day"
                value={String(f.weekday)}
                onChange={(v) => setF({ ...f, weekday: Number(v) })}
                options={WEEKDAY_LABEL.map((l, i) => ({ value: String(i + 1), label: l }))}
              />
            </FormField>
          )}
          {f.frequency === "monthly" && (
            <FormField id="sch-md" label="Tanggal (1–28)">
              <Input
                id="sch-md"
                type="number"
                min={1}
                max={28}
                value={f.monthday}
                onChange={(e) => setF({ ...f, monthday: Number(e.target.value) })}
              />
            </FormField>
          )}
          {f.frequency !== "none" && (
            <>
              <FormField id="sch-hour" label="Jam kirim (zona waktu organisasi)">
                <Input
                  id="sch-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={f.hour}
                  onChange={(e) => setF({ ...f, hour: Number(e.target.value) })}
                />
              </FormField>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Penerima</legend>
                <div className="flex flex-wrap gap-2">
                  {owners.map((o) => {
                    const on = f.recipientIds.includes(o.userId);
                    return (
                      <button
                        key={o.userId}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setF({
                            ...f,
                            recipientIds: on
                              ? f.recipientIds.filter((x) => x !== o.userId)
                              : [...f.recipientIds, o.userId],
                          })
                        }
                        className={
                          on
                            ? "bg-secondary text-primary h-8 rounded-3xl px-3 text-sm font-medium"
                            : "text-muted-foreground hover:bg-secondary h-8 rounded-3xl border px-3 text-sm"
                        }
                      >
                        {o.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}
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
              Simpan jadwal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportBuilder({
  saved,
  options,
  canShareOrg,
}: {
  saved: SavedReportDto[];
  options: Options;
  canShareOrg: boolean;
}) {
  const router = useRouter();
  const can = useCan();
  const [plan, setPlan] = useState<InsightPlan>(blank);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"personal" | "organization">("personal");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [schedule, setSchedule] = useState<SavedReportDto | null>(null);
  const [pending, start] = useTransition();
  const e = plan.entity;
  const set = (p: Partial<InsightPlan>) => setPlan({ ...plan, ...p });
  const unusedFilters = FILTER_FIELDS[e].filter((f) => !plan.filters.some((x) => x.field === f));

  function run() {
    start(async () => {
      const res = await runCustomReport({ definition: plan });
      if (!res.ok) {
        setResult(null);
        return void toast.error(res.error);
      }
      setResult(res.data);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Report Builder</CardTitle>
            <CardDescription>
              Susun laporan sendiri dari data CRM. Hasil selalu mengikuti izin Anda; simpan untuk
              dipakai ulang, diekspor, atau dikirim terjadwal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="rb-entity" label="Data">
              <SelectField
                id="rb-entity"
                value={e}
                onChange={(v) => {
                  const ent = v as InsightEntity;
                  setPlan({
                    ...blank(),
                    entity: ent,
                    period: { field: PERIOD_FIELDS[ent][0], preset: plan.period.preset },
                  });
                  setResult(null);
                }}
                options={INSIGHT_ENTITIES.map((x) => ({ value: x, label: ENTITY_LABEL[x] }))}
              />
            </FormField>
            <FormField id="rb-metric" label="Tampilkan">
              <SelectField
                id="rb-metric"
                value={plan.metric}
                onChange={(v) => set({ metric: v as InsightPlan["metric"] })}
                options={(["count", "sum", "list"] as const)
                  .filter((m) => m !== "sum" || SUM_FIELDS[e])
                  .map((m) => ({ value: m, label: METRIC_LABEL[m] }))}
              />
            </FormField>
            {plan.metric !== "list" ? (
              <FormField id="rb-group" label="Kelompokkan per">
                <SelectField
                  id="rb-group"
                  value={plan.groupBy ?? ""}
                  onChange={(v) => set({ groupBy: v || null })}
                  noneLabel="Tanpa kelompok"
                  options={GROUP_FIELDS[e].map((g) => ({ value: g, label: lbl(g) }))}
                />
              </FormField>
            ) : (
              <FormField id="rb-limit" label="Jumlah baris (1–20)">
                <Input
                  id="rb-limit"
                  type="number"
                  min={1}
                  max={20}
                  value={plan.limit}
                  onChange={(ev) =>
                    set({ limit: Math.min(20, Math.max(1, Number(ev.target.value) || 1)) })
                  }
                />
              </FormField>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="rb-period" label="Periode">
              <SelectField
                id="rb-period"
                value={plan.period.preset}
                onChange={(v) =>
                  set({ period: { ...plan.period, preset: v as InsightPlan["period"]["preset"] } })
                }
                options={PERIOD_PRESETS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              />
            </FormField>
            {PERIOD_FIELDS[e].length > 1 && (
              <FormField id="rb-pfield" label="Berdasarkan tanggal">
                <SelectField
                  id="rb-pfield"
                  value={plan.period.field}
                  onChange={(v) => set({ period: { ...plan.period, field: v } })}
                  options={PERIOD_FIELDS[e].map((p) => ({ value: p, label: lbl(p) }))}
                />
              </FormField>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Filter</p>
            {plan.filters.map((f, i) => (
              <div key={f.field} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm">{lbl(f.field)}</span>
                <div className="w-52">
                  <SelectField
                    value={f.value}
                    placeholder="Pilih nilai"
                    onChange={(v) =>
                      set({
                        filters: plan.filters.map((x, j) => (j === i ? { ...x, value: v } : x)),
                      })
                    }
                    options={valueOptions(f.field, e, options)}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Hapus filter ${lbl(f.field)}`}
                  onClick={() => set({ filters: plan.filters.filter((_, j) => j !== i) })}
                >
                  <X />
                </Button>
              </div>
            ))}
            {unusedFilters.length > 0 && (
              <div className="w-52">
                <SelectField
                  value=""
                  placeholder="+ Tambah filter…"
                  onChange={(v) =>
                    v && set({ filters: [...plan.filters, { field: v, value: "" }] })
                  }
                  options={unusedFilters.map((f) => ({ value: f, label: lbl(f) }))}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={run} disabled={pending || plan.filters.some((f) => !f.value)}>
              <Play /> Jalankan
            </Button>
            <div className="min-w-48">
              <Input
                aria-label="Nama laporan"
                placeholder="Nama laporan"
                value={name}
                maxLength={80}
                onChange={(ev) => setName(ev.target.value)}
              />
            </div>
            {canShareOrg && (
              <div className="w-44">
                <SelectField
                  value={visibility}
                  onChange={(v) => setVisibility(v as typeof visibility)}
                  options={[
                    { value: "personal", label: "Pribadi" },
                    { value: "organization", label: "Seluruh organisasi" },
                  ]}
                />
              </div>
            )}
            <Button
              variant="outline"
              disabled={pending || name.trim().length < 3 || plan.filters.some((f) => !f.value)}
              onClick={() =>
                start(async () => {
                  const res = await saveCustomReport({
                    id: editingId,
                    name,
                    definition: plan,
                    visibility,
                  });
                  if (!res.ok) return void toast.error(res.fieldErrors?.name ?? res.error);
                  toast.success("Laporan disimpan");
                  setEditingId(res.data.id);
                  router.refresh();
                })
              }
            >
              <Save /> {editingId ? "Perbarui" : "Simpan laporan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{result.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResultTable r={result} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Laporan tersimpan</CardTitle>
        </CardHeader>
        <CardContent>
          {saved.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada laporan tersimpan.</p>
          ) : (
            <ul className="divide-y rounded-lg border" data-testid="saved-reports">
              {saved.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      {r.visibility === "organization" && (
                        <ToneBadge tone="purple">Organisasi</ToneBadge>
                      )}
                      {r.frequency !== "none" && (
                        <ToneBadge tone="blue">
                          {FREQUENCY_LABEL[r.frequency as keyof typeof FREQUENCY_LABEL]}
                        </ToneBadge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {ENTITY_LABEL[r.definition.entity]} · {METRIC_LABEL[r.definition.metric]} ·{" "}
                      {PERIOD_LABEL[r.definition.period.preset]}
                      {r.nextRunAt &&
                        ` · berikutnya ${new Date(r.nextRunAt).toLocaleString("id-ID")}`}
                      {r.lastStatus && ` · terakhir: ${r.lastStatus}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <RowAction
                      icon={FolderOpen}
                      label="Buka"
                      variant="outline"
                      onClick={() => {
                        setPlan(r.definition);
                        setName(r.name);
                        setVisibility(r.visibility as typeof visibility);
                        setEditingId(r.mine ? r.id : undefined);
                        setResult(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                    {can("export", "Report") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="max-lg:size-10 max-lg:rounded-full max-lg:px-0"
                        >
                          <a
                            href={`/api/reports/saved/${r.id}/export?format=csv`}
                            download
                            title="Unduh CSV"
                          >
                            <Download /> <span className="max-lg:sr-only">CSV</span>
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="max-lg:size-10 max-lg:rounded-full max-lg:px-0"
                        >
                          <a
                            href={`/api/reports/saved/${r.id}/export?format=xlsx`}
                            download
                            title="Unduh XLSX"
                          >
                            <FileSpreadsheet /> <span className="max-lg:sr-only">XLSX</span>
                          </a>
                        </Button>
                      </>
                    )}
                    {r.mine && can("export", "Report") && (
                      <RowAction
                        icon={CalendarClock}
                        label="Jadwal"
                        variant="outline"
                        onClick={() => setSchedule(r)}
                      />
                    )}
                    {r.mine && (
                      <RowAction
                        icon={Trash2}
                        label="Hapus"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await deleteCustomReport({ id: r.id });
                            if (!res.ok) toast.error(res.error);
                            else {
                              toast.success("Laporan dihapus");
                              router.refresh();
                            }
                          })
                        }
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {schedule && (
        <ScheduleDialog
          key={schedule.id}
          report={schedule}
          owners={options.owners}
          onClose={() => {
            setSchedule(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
