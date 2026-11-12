"use client";

import { MessageCircle, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectField } from "@/components/shared/select-field";
import { ToneBadge } from "@/components/shared/tone-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANNEL_KINDS,
  CHANNEL_LABEL,
  CHANNEL_TONE,
  type ChannelKind,
} from "@/modules/omnichannel/constants";
import { MAX_MESSAGE_LENGTH } from "@/modules/whatsapp/constants";
import {
  assignConversation,
  createLeadFromConversation,
  markConversationRead,
  sendConversationMessage,
  setConversationStatus,
} from "@/modules/whatsapp/server/actions";

export type ConvRow = {
  id: string;
  kind: string;
  phone: string | null;
  email: string | null;
  channelLabel: string | null;
  displayName: string | null;
  status: string;
  assigneeId: string | null;
  unreadCount: number;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  contact: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
};
export type MsgRow = {
  id: string;
  direction: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: Date;
};
type Owner = { userId: string; name: string };

const label = (c: Pick<ConvRow, "displayName" | "phone" | "email" | "channelLabel">) =>
  c.displayName ?? c.phone ?? c.email ?? c.channelLabel ?? "Percakapan";
const addressOf = (c: Pick<ConvRow, "phone" | "email" | "channelLabel" | "kind">) =>
  c.kind === "email" ? c.email : c.kind === "other" ? c.channelLabel : c.phone;
const fmt = (d: Date) =>
  new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "mine", label: "Milik saya" },
  { key: "unassigned", label: "Belum ditugaskan" },
] as const;

function href(filter: string, status: string, c?: string, kind?: string) {
  const sp = new URLSearchParams();
  if (kind) sp.set("kind", kind);
  if (filter !== "all") sp.set("filter", filter);
  if (status !== "open") sp.set("status", status);
  if (c) sp.set("c", c);
  const qs = sp.toString();
  return qs ? `/inbox?${qs}` : "/inbox";
}

function Thread({
  conv,
  messages,
  owners,
  me,
  role,
  canLead,
}: {
  conv: ConvRow;
  messages: MsgRow[];
  owners: Owner[];
  me: string;
  role: string;
  canLead: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const isRep = role === "sales_rep";

  useEffect(() => {
    if (conv.unreadCount > 0) void markConversationRead({ id: conv.id });
  }, [conv.id, conv.unreadCount]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conv.id]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const res = await sendConversationMessage({ conversationId: conv.id, body });
      if (!res.ok) toast.error(res.error);
      else setText("");
      router.refresh();
    });
  }
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gagal");
      else if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{label(conv)}</h2>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <ToneBadge tone={CHANNEL_TONE[conv.kind as ChannelKind] ?? "blue"}>
              {CHANNEL_LABEL[conv.kind as ChannelKind] ?? conv.kind}
            </ToneBadge>
            <span>{addressOf(conv)}</span>
            {conv.contact && (
              <Link className="text-primary hover:underline" href={`/contacts/${conv.contact.id}`}>
                Contact: {conv.contact.name}
              </Link>
            )}
            {conv.lead && (
              <Link className="text-primary hover:underline" href={`/leads/${conv.lead.id}`}>
                Lead: {conv.lead.name}
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRep ? (
            conv.assigneeId === me ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => act(() => assignConversation({ id: conv.id, assigneeId: null }))}
              >
                Lepas
              </Button>
            ) : !conv.assigneeId ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  act(
                    () => assignConversation({ id: conv.id, assigneeId: me }),
                    "Percakapan diambil",
                  )
                }
              >
                Ambil
              </Button>
            ) : null
          ) : (
            <div className="w-44">
              <SelectField
                id="assignee"
                value={conv.assigneeId ?? ""}
                onChange={(v) =>
                  act(
                    () => assignConversation({ id: conv.id, assigneeId: v || null }),
                    "Penugasan diubah",
                  )
                }
                noneLabel="Belum ditugaskan"
                options={owners.map((o) => ({ value: o.userId, label: o.name }))}
              />
            </div>
          )}
          {canLead && !conv.contact && !conv.lead && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => act(() => createLeadFromConversation({ id: conv.id }), "Lead dibuat")}
            >
              <UserPlus /> Buat lead
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              act(() =>
                setConversationStatus({
                  id: conv.id,
                  status: conv.status === "open" ? "closed" : "open",
                }),
              )
            }
          >
            {conv.status === "open" ? "Tutup" : "Buka kembali"}
          </Button>
        </div>
      </div>
      <div className="bg-muted/40 flex-1 space-y-2 overflow-y-auto p-3" data-testid="thread">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "out" && "justify-end")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-card border",
              )}
            >
              {m.body}
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  m.direction === "out" ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {fmt(m.createdAt)}
                {m.direction === "out" &&
                  ` · ${m.status === "sent" ? "Terkirim" : m.status === "failed" ? `Gagal${m.error ? `: ${m.error}` : ""}` : "Mengirim"}`}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
        <Textarea
          aria-label="Tulis pesan"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis balasan… (dikirim hanya saat Anda menekan Kirim)"
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          <Send /> Kirim
        </Button>
      </form>
    </div>
  );
}

export function Inbox({
  conversations,
  selected,
  filter,
  status,
  kind,
  owners,
  me,
  role,
  canLead,
}: {
  conversations: ConvRow[];
  selected: { conv: ConvRow; messages: MsgRow[] } | null;
  filter: string;
  status: string;
  kind?: string;
  owners: Owner[];
  me: string;
  role: string;
  canLead: boolean;
}) {
  const router = useRouter();
  // Muat ulang berkala agar pesan masuk muncul tanpa refresh manual.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);
  const ownerName = new Map(owners.map((o) => [o.userId, o.name]));

  return (
    <Card className="grid h-[calc(100vh-11rem)] min-h-[32rem] grid-cols-1 overflow-hidden md:grid-cols-[20rem_1fr]">
      <div className={cn("flex min-h-0 flex-col border-r", selected && "hidden md:flex")}>
        <div className="space-y-2 border-b p-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href(f.key, status, undefined, kind)}
                aria-current={filter === f.key ? "page" : undefined}
                className={cn(
                  "h-8 rounded-3xl px-3 text-xs leading-8",
                  filter === f.key
                    ? "bg-secondary text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="kind-filter">
            {[
              { key: "", label: "Semua kanal" },
              ...CHANNEL_KINDS.map((k) => ({ key: k, label: CHANNEL_LABEL[k] })),
            ].map((k) => (
              <Link
                key={k.key}
                href={href(filter, status, undefined, k.key || undefined)}
                aria-current={(kind ?? "") === k.key ? "page" : undefined}
                className={cn(
                  "h-7 rounded-3xl px-2.5 text-xs leading-7",
                  (kind ?? "") === k.key
                    ? "bg-secondary text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {k.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["open", "closed"] as const).map((s) => (
              <Link
                key={s}
                href={href(filter, s, undefined, kind)}
                className={cn(
                  "text-xs",
                  status === s
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:underline",
                )}
              >
                {s === "open" ? "Terbuka" : "Ditutup"}
              </Link>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto" data-testid="conversation-list">
          {conversations.length === 0 && (
            <li className="text-muted-foreground p-6 text-center text-sm">Tidak ada percakapan.</li>
          )}
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={href(filter, status, c.id, kind)}
                className={cn(
                  "hover:bg-accent/50 block space-y-0.5 px-3 py-2.5",
                  selected?.conv.id === c.id && "bg-accent",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    <span className="text-muted-foreground mr-1.5 text-[11px] font-normal">
                      {CHANNEL_LABEL[c.kind as ChannelKind] ?? c.kind}
                    </span>
                    {label(c)}
                  </span>
                  {c.unreadCount > 0 && <Badge>{c.unreadCount}</Badge>}
                </div>
                <p className="text-muted-foreground truncate text-xs">{c.lastMessagePreview}</p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{fmt(c.lastMessageAt)}</span>
                  <ToneBadge tone={c.assigneeId ? "blue" : "orange"}>
                    {c.assigneeId
                      ? (ownerName.get(c.assigneeId) ?? "Ditugaskan")
                      : "Belum ditugaskan"}
                  </ToneBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {selected ? (
        <div className="flex min-h-0 flex-col">
          <Link
            href={href(filter, status, undefined, kind)}
            className="text-primary border-b px-3 py-2 text-xs md:hidden"
          >
            ← Daftar percakapan
          </Link>
          <Thread
            conv={selected.conv}
            messages={selected.messages}
            owners={owners}
            me={me}
            role={role}
            canLead={canLead}
          />
        </div>
      ) : (
        <div className="hidden items-center justify-center md:flex">
          <EmptyState
            icon={MessageCircle}
            title="Pilih percakapan"
            description="Pilih percakapan di kiri untuk membaca dan membalas."
          />
        </div>
      )}
    </Card>
  );
}
