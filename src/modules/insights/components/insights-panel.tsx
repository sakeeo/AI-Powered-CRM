"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITY_LABEL, PERIOD_LABEL, type InsightPlan } from "@/modules/insights/plan";
import { aiAskCrm } from "@/modules/insights/server/ai-actions";
import type { InsightResult } from "@/modules/insights/server/execute";

const EXAMPLES = [
  "Berapa lead baru bulan ini?",
  "Total nilai deal Won tahun ini",
  "Jumlah deal per stage",
  "Daftar quotation terkirim 30 hari terakhir",
  "Aktivitas terbuka per owner",
];

function planText(p: InsightPlan) {
  const parts = [
    `${p.metric === "count" ? "Hitung" : p.metric === "sum" ? "Jumlahkan nilai" : "Tampilkan daftar"} ${ENTITY_LABEL[p.entity]}`,
    ...p.filters.map((f) => `${f.field} = ${f.value}`),
    `periode: ${PERIOD_LABEL[p.period.preset]}${p.period.preset !== "all" ? ` (${p.period.field})` : ""}`,
    ...(p.groupBy ? [`kelompok: ${p.groupBy}`] : []),
  ];
  return parts.join(" · ");
}

export function InsightsPanel() {
  const [q, setQ] = useState("");
  const [out, setOut] = useState<{ plan: InsightPlan; result: InsightResult } | null>(null);
  const [pending, start] = useTransition();

  function ask(question: string) {
    start(async () => {
      const res = await aiAskCrm({ question });
      if (!res.ok) {
        setOut(null);
        return void toast.error(res.fieldErrors?.question ?? res.error);
      }
      setOut(res.data as { plan: InsightPlan; result: InsightResult });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tanya CRM</CardTitle>
            <CardDescription>
              Ajukan pertanyaan tentang data Anda dalam bahasa sehari-hari. AI hanya menerjemahkan
              pertanyaan menjadi kueri baca-saja; angka berasal dari database dan hanya mencakup
              data yang boleh Anda lihat. Tidak ada data yang diubah.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <div className="min-w-64 flex-1">
              <Input
                aria-label="Pertanyaan"
                placeholder="Mis. Berapa deal Won bulan ini?"
                maxLength={300}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending || q.trim().length < 5}>
              <Sparkles /> {pending ? "Memproses…" : "Tanya"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={pending}
                onClick={() => {
                  setQ(ex);
                  ask(ex);
                }}
                className="text-muted-foreground hover:bg-secondary h-8 rounded-3xl border px-3 text-xs"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {out && (
        <Card data-testid="insight-result">
          <CardHeader>
            <div>
              <CardTitle>{out.result.title}</CardTitle>
              <CardDescription>{out.result.summary}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {out.result.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">Tidak ada data yang cocok.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {out.result.columns.map((c) => (
                        <TableHead key={c} className="text-xs">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {out.result.rows.map((r, i) => (
                      <TableRow key={i}>
                        {r.map((cell, j) => (
                          <TableCell
                            key={j}
                            className={typeof cell === "number" ? "tabular-nums" : undefined}
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Cara pertanyaan dipahami: {planText(out.plan)}. Periksa kesesuaiannya dengan maksud
              Anda.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
