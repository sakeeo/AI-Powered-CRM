"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { moveDealStage } from "@/modules/deals/server/actions";
import type { KanbanCard, StageSummary } from "@/modules/deals/server/queries";

const sum = (cards: KanbanCard[]) => {
  const t: Record<string, number> = {};
  for (const c of cards) t[c.currency] = (t[c.currency] ?? 0) + Number(c.value);
  return Object.entries(t)
    .map(([cur, v]) => formatMoney(v, cur))
    .join(" · ");
};

/**
 * Papan Kanban. Drag-and-drop (mouse, sentuh, dan keyboard: Spasi untuk angkat, panah untuk pindah)
 * memperbarui stage secara optimistik; bila server menolak, posisi dikembalikan (rollback).
 */
export function KanbanBoard({
  stages,
  cards: initial,
  ownerNames,
  truncated,
}: {
  stages: StageSummary[];
  cards: KanbanCard[];
  ownerNames: Record<string, string>;
  truncated: boolean;
}) {
  const can = useCan();
  const [cards, setCards] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  // Sinkronkan ulang bila data server berubah (router.refresh / filter).
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setCards(initial);
  }

  async function onDragEnd(r: DropResult) {
    const to = r.destination?.droppableId;
    if (!to || to === r.source.droppableId) return;
    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === r.draggableId ? { ...c, stageId: to } : c)));
    const res = await moveDealStage({ id: r.draggableId, stageId: to });
    if (!res.ok) {
      setCards(before);
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-2">
      {truncated && (
        <p className="text-muted-foreground text-xs">
          Menampilkan sebagian deal. Persempit dengan filter owner atau periode.
        </p>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2" data-testid="kanban-board">
          {stages.map((s) => {
            const col = cards.filter((c) => c.stageId === s.stageId);
            return (
              <div key={s.stageId} className="w-72 shrink-0">
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                    <span className="text-muted-foreground text-xs tabular-nums">{col.length}</span>
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">{sum(col) || "Rp 0"}</p>
                </div>
                <Droppable droppableId={s.stageId}>
                  {(drop, snap) => (
                    <div
                      ref={drop.innerRef}
                      {...drop.droppableProps}
                      data-testid={`col-${s.name}`}
                      className={`bg-muted/40 min-h-24 space-y-2 rounded-lg p-2 ${snap.isDraggingOver ? "bg-primary/10" : ""}`}
                    >
                      {col.map((c, i) => (
                        <Draggable
                          key={c.id}
                          draggableId={c.id}
                          index={i}
                          isDragDisabled={!can("update", "Deal", c)}
                        >
                          {(drag) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                            >
                              <Card className="p-card gap-1.5">
                                <Link
                                  href={`/deals/${c.id}`}
                                  className="text-sm leading-tight font-medium hover:underline"
                                  draggable={false}
                                >
                                  {c.title}
                                </Link>
                                <p className="text-muted-foreground truncate text-xs">
                                  {[c.contact?.name, c.company?.name].filter(Boolean).join(" · ") ||
                                    "—"}
                                </p>
                                <p className="text-sm font-semibold tabular-nums">
                                  {formatMoney(c.value, c.currency)}
                                </p>
                                <div className="text-muted-foreground flex items-center justify-between text-xs">
                                  <span className="tabular-nums">
                                    {c.expectedCloseDate
                                      ? new Date(c.expectedCloseDate).toLocaleDateString("id-ID")
                                      : "Tanpa tanggal"}
                                  </span>
                                  <span className="truncate">
                                    {(c.ownerId && ownerNames[c.ownerId]) || ""}
                                  </span>
                                </div>
                                {c.risk && (
                                  <ToneBadge tone={c.risk.level === "high" ? "red" : "orange"}>
                                    <span
                                      className="inline-flex items-center gap-1"
                                      title="Indikator informatif; tidak mengubah deal"
                                      data-testid="risk-badge"
                                    >
                                      <AlertTriangle className="size-3" /> {c.risk.reason}
                                    </span>
                                  </ToneBadge>
                                )}
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
