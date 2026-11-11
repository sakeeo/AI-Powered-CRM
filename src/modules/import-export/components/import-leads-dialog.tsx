"use client";

import Papa from "papaparse";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { ProgressBar } from "@/components/shared/progress-bar";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { OwnerOption, SourceOption } from "@/modules/leads/components/lead-form";
import {
  applyMapping,
  guessMapping,
  IMPORT_BATCH_SIZE,
  LEAD_IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  validateLeadRow,
  type ColumnMapping,
} from "@/modules/import-export/mapping";
import { importLeadsBatch, type ImportRowError } from "@/modules/import-export/server/actions";

type Parsed = { headers: string[]; rows: Record<string, string>[] };

function downloadErrors(errors: ImportRowError[]) {
  const csv = Papa.unparse({
    fields: ["baris", "pesan"],
    data: errors.map((e) => [e.row, e.message]),
  });
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "laporan-error-impor.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Impor lead dari CSV: parse di browser (PapaParse) → pemetaan kolom → pratinjau validasi →
 * kirim per batch ke server (validasi ulang di server) dengan progres. UI tetap responsif untuk ribuan baris.
 */
export function ImportLeadsDialog({
  sources,
  owners,
  canAssignOwner,
}: {
  sources: SourceOption[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<Parsed>();
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [sourceId, setSourceId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [progress, setProgress] = useState<number>();
  const [result, setResult] = useState<{ created: number; errors: ImportRowError[] }>();

  function reset() {
    setParsed(undefined);
    setMapping({});
    setProgress(undefined);
    setResult(undefined);
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        if (!headers.length || !res.data.length)
          return void toast.error("Berkas kosong atau tidak terbaca");
        if (res.data.length > MAX_IMPORT_ROWS)
          return void toast.error(
            `Maksimal ${MAX_IMPORT_ROWS} baris per impor (berkas berisi ${res.data.length})`,
          );
        setParsed({ headers, rows: res.data });
        setMapping(guessMapping(headers));
      },
      error: () => toast.error("Gagal membaca berkas CSV"),
    });
  }

  const mapped = parsed ? parsed.rows.map((r) => applyMapping(r, mapping)) : [];
  const preview = mapped.slice(0, 200).map((r) => validateLeadRow(r).success);
  const previewInvalid = preview.filter((ok) => !ok).length;

  async function run() {
    if (!parsed) return;
    setProgress(0);
    let created = 0;
    const errors: ImportRowError[] = [];
    for (let i = 0; i < mapped.length; i += IMPORT_BATCH_SIZE) {
      const res = await importLeadsBatch({
        rows: mapped.slice(i, i + IMPORT_BATCH_SIZE),
        startRow: i + 2, // baris 1 = header
        sourceId: sourceId || undefined,
        ownerId: ownerId || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        break;
      }
      created += res.data.created;
      errors.push(...res.data.errors);
      setProgress(
        Math.round((Math.min(i + IMPORT_BATCH_SIZE, mapped.length) / mapped.length) * 100),
      );
    }
    setResult({ created, errors });
    setProgress(undefined);
    router.refresh();
  }

  const importing = progress !== undefined;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload /> Impor CSV
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!importing) {
            setOpen(v);
            if (!v) reset();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Impor lead dari CSV</DialogTitle>
            <DialogDescription>
              Baris yang tidak valid dilewati dan dilaporkan; baris valid tetap diimpor. Maksimal{" "}
              {MAX_IMPORT_ROWS} baris.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3" data-testid="import-result">
              <p className="text-sm">
                <strong>{result.created}</strong> lead berhasil diimpor,{" "}
                <strong>{result.errors.length}</strong> baris ditolak.
              </p>
              {result.errors.length > 0 && (
                <>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {result.errors.slice(0, 50).map((e) => (
                      <li key={e.row}>
                        Baris {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" onClick={() => downloadErrors(result.errors)}>
                    Unduh laporan error
                  </Button>
                </>
              )}
              <div>
                <Button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  Selesai
                </Button>
              </div>
            </div>
          ) : !parsed ? (
            <FormField
              id="import-file"
              label="Berkas CSV"
              hint="Baris pertama harus berisi nama kolom."
            >
              <Input
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </FormField>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">{parsed.rows.length} baris terbaca. Cocokkan kolom:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {LEAD_IMPORT_FIELDS.map((f) => (
                  <FormField
                    key={f.key}
                    id={`map-${f.key}`}
                    label={f.label + ("required" in f && f.required ? " *" : "")}
                  >
                    <SelectField
                      id={`map-${f.key}`}
                      value={mapping[f.key]}
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v || undefined }))}
                      noneLabel="— Abaikan —"
                      options={parsed.headers.map((h) => ({ value: h, label: h }))}
                    />
                  </FormField>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="import-source" label="Sumber lead">
                  <SelectField
                    id="import-source"
                    value={sourceId}
                    onChange={setSourceId}
                    noneLabel="Tanpa sumber"
                    options={sources.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </FormField>
                {canAssignOwner && (
                  <FormField id="import-owner" label="Owner">
                    <SelectField
                      id="import-owner"
                      value={ownerId}
                      onChange={setOwnerId}
                      noneLabel="Belum ditugaskan"
                      options={owners.map((o) => ({ value: o.userId, label: o.name }))}
                    />
                  </FormField>
                )}
              </div>
              <p
                className={
                  previewInvalid ? "text-destructive text-xs" : "text-muted-foreground text-xs"
                }
              >
                Pratinjau {preview.length} baris pertama: {preview.length - previewInvalid} valid,{" "}
                {previewInvalid} bermasalah.
              </p>
              {importing && <ProgressBar value={progress} label="Progres impor" />}
              <div className="flex gap-2">
                <Button disabled={importing || !mapping.name} onClick={run}>
                  {importing ? `Mengimpor… ${progress}%` : `Impor ${parsed.rows.length} baris`}
                </Button>
                <Button variant="outline" disabled={importing} onClick={reset}>
                  Ganti berkas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
