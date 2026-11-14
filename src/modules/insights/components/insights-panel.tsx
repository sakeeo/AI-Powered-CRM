"use client";

import { Bot, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  "Aktivitas terbuka per PIC",
];

const WELCOME =
  "Halo! Tanyakan apa saja tentang data CRM Anda dalam bahasa sehari-hari. Saya hanya menerjemahkan pertanyaan menjadi kueri baca-saja; angka berasal dari database dan hanya mencakup data yang boleh Anda lihat. Tidak ada data yang diubah.";

type Message =
  | { id: number; role: "user"; text: string; at: Date }
  | { id: number; role: "ai"; text: string; at: Date; error?: boolean }
  | { id: number; role: "ai-result"; at: Date; plan: InsightPlan; result: InsightResult };

function planText(p: InsightPlan) {
  const parts = [
    `${p.metric === "count" ? "Hitung" : p.metric === "sum" ? "Jumlahkan nilai" : "Tampilkan daftar"} ${ENTITY_LABEL[p.entity]}`,
    ...p.filters.map((f) => `${f.field} = ${f.value}`),
    `periode: ${PERIOD_LABEL[p.period.preset]}${p.period.preset !== "all" ? ` (${p.period.field})` : ""}`,
    ...(p.groupBy ? [`kelompok: ${p.groupBy}`] : []),
  ];
  return parts.join(" · ");
}

const clock = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Gelembung percakapan ala WhatsApp: pengguna kanan (hijau muda), AI kiri (putih) dengan ekor kecil. */
function Bubble({
  mine,
  error,
  wide,
  at,
  children,
  testId,
}: {
  mine?: boolean;
  error?: boolean;
  wide?: boolean;
  at?: Date;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        data-testid={testId}
        className={cn(
          "rounded-xl px-3 pt-1.5 pb-1 text-sm shadow-sm",
          wide ? "w-full max-w-[min(100%,52rem)]" : "max-w-[82%] sm:max-w-[70%]",
          mine
            ? "bg-tone-green-soft text-foreground rounded-tr-sm"
            : error
              ? "bg-tone-red-soft text-tone-red-ink rounded-tl-sm"
              : "bg-card text-foreground rounded-tl-sm",
        )}
      >
        {children}
        {at && (
          <p className="text-muted-foreground mt-0.5 text-right text-[10px] tabular-nums">
            {clock(at)}
          </p>
        )}
      </div>
    </div>
  );
}

export function InsightsPanel() {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function ask(question: string) {
    const text = question.trim();
    if (text.length < 5 || pending) return;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text, at: new Date() }]);
    setQ("");
    start(async () => {
      const res = await aiAskCrm({ question: text });
      if (!res.ok) {
        const msg = res.fieldErrors?.question ?? res.error;
        toast.error(msg);
        setMessages((m) => [
          ...m,
          { id: nextId.current++, role: "ai", text: msg, at: new Date(), error: true },
        ]);
        return;
      }
      const data = res.data as { plan: InsightPlan; result: InsightResult };
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "ai-result", at: new Date(), ...data },
      ]);
    });
  }

  // Mentok bawah layar: -mb meniadakan padding bawah layout (pb-32 + p-5); composer sticky di dasar viewport.
  return (
    <Card className="-mb-[9.25rem] flex min-h-[calc(100dvh-6.25rem)] flex-col overflow-clip rounded-b-none p-0">
      <header className="bg-primary text-primary-foreground flex shrink-0 items-center gap-3 px-4 py-3">
        <span className="bg-primary-foreground/15 grid size-10 shrink-0 place-items-center rounded-full">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="font-semibold">Tanya CRM</h2>
          <p className="text-primary-foreground/80 text-xs" aria-live="polite">
            {pending ? "sedang mengetik…" : "online · jawaban dari data database"}
          </p>
        </div>
      </header>

      <div className="bg-secondary flex-1 space-y-1.5 px-3 py-4 sm:px-6" data-testid="chat-thread">
        <Bubble wide>
          <p className="break-words whitespace-pre-wrap">{WELCOME}</p>
        </Bubble>

        {messages.map((m) => {
          if (m.role === "user")
            return (
              <Bubble key={m.id} mine at={m.at}>
                <p className="break-words whitespace-pre-wrap">{m.text}</p>
              </Bubble>
            );
          if (m.role === "ai")
            return (
              <Bubble key={m.id} error={m.error} at={m.at}>
                <p className="break-words whitespace-pre-wrap">{m.text}</p>
              </Bubble>
            );
          return (
            <Bubble key={m.id} wide at={m.at} testId="insight-result">
              <p className="font-semibold">{m.result.title}</p>
              <p className="text-muted-foreground mb-2 text-xs">{m.result.summary}</p>
              {m.result.rows.length === 0 ? (
                <p className="text-muted-foreground">Tidak ada data yang cocok.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {m.result.columns.map((c) => (
                          <TableHead key={c} className="text-xs">
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.result.rows.map((r, i) => (
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
              <p className="text-muted-foreground mt-2 text-[11px] italic">
                Cara pertanyaan dipahami: {planText(m.plan)}. Periksa kesesuaiannya dengan maksud
                Anda.
              </p>
            </Bubble>
          );
        })}

        {pending && (
          <div className="flex justify-start" aria-hidden>
            <div className="bg-card flex gap-1 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} className="scroll-mb-28" />
      </div>

      <div className="bg-card sticky bottom-0 z-10 border-t">
        {messages.length === 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 sm:px-6">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={pending}
                onClick={() => ask(ex)}
                className="text-primary hover:bg-secondary h-8 shrink-0 rounded-3xl border px-3 text-xs"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 px-3 py-3 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <input
            aria-label="Pertanyaan"
            placeholder="Ketik pertanyaan, mis. Berapa deal Won bulan ini?"
            maxLength={300}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-secondary placeholder:text-muted-foreground focus-visible:ring-ring/50 h-11 min-w-0 flex-1 rounded-3xl px-5 text-sm outline-none focus-visible:ring-3"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            aria-label="Kirim pertanyaan"
            disabled={pending || q.trim().length < 5}
          >
            <SendHorizontal />
          </Button>
        </form>
      </div>
    </Card>
  );
}
