"use client";

import { Bot, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChatMarkdown } from "@/modules/assistant/components/chat-markdown";
import { aiAssistantChat } from "@/modules/assistant/server/actions";

type Msg = { id: number; role: "user" | "assistant"; content: string; at: Date; error?: boolean };

const GREETING: Msg = {
  id: 0,
  role: "assistant",
  content:
    "Halo! Saya AI Assistant. Saya bisa menjawab pertanyaan tentang data CRM Anda (lead, deal, aktivitas, quotation), menyusun pesan follow-up, atau memberi saran penjualan. Ada yang bisa dibantu?",
  at: new Date(),
};

const hhmm = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

/** Tombol melayang + popup chat bergaya WhatsApp. Riwayat hanya di memori browser (tidak disimpan). */
export function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || pending) return;
    const mine: Msg = { id: nextId.current++, role: "user", content, at: new Date() };
    const history = [...messages, mine];
    setMessages(history);
    setText("");
    start(async () => {
      const res = await aiAssistantChat({
        // Sapaan awal dan pesan galat bukan bagian percakapan model.
        messages: history
          .filter((m) => m.id !== 0 && !m.error)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content })),
      });
      const reply: Msg = {
        id: nextId.current++,
        role: "assistant",
        at: new Date(),
        content: res.ok ? res.data.reply : res.error,
        error: !res.ok,
      };
      setMessages((prev) => [...prev, reply]);
    });
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="AI Assistant"
          className="bg-card shadow-popover fixed right-3 bottom-36 z-40 flex h-[34rem] max-h-[calc(100dvh-10rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border sm:right-5 sm:w-96"
        >
          <header className="bg-primary text-primary-foreground flex items-center gap-3 px-4 py-3">
            <span className="bg-primary-foreground/15 grid size-10 place-items-center rounded-full">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">AI Assistant</p>
              <p className="text-primary-foreground/80 text-xs">
                {pending ? "sedang mengetik…" : "online"}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Tutup chat"
              className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </header>

          <div className="bg-secondary flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
            {messages.map((m) => {
              const mine = m.role === "user";
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      mine
                        ? "max-w-[82%] rounded-xl px-3 py-1.5 text-sm shadow-sm"
                        : "max-w-[94%] rounded-xl px-3 py-1.5 text-sm shadow-sm",
                      mine
                        ? "bg-tone-green-soft text-foreground rounded-tr-sm"
                        : m.error
                          ? "bg-tone-red-soft text-tone-red-ink rounded-tl-sm"
                          : "bg-card text-foreground rounded-tl-sm",
                    ].join(" ")}
                  >
                    {mine || m.error ? (
                      <p className="break-words whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <ChatMarkdown content={m.content} />
                    )}
                    <p className="text-muted-foreground mt-0.5 text-right text-[10px]">
                      {hhmm(m.at)}
                    </p>
                  </div>
                </div>
              );
            })}
            {pending && (
              <div className="flex justify-start">
                <div className="bg-card flex gap-1 rounded-xl rounded-tl-sm px-3 py-2.5 shadow-sm">
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
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="bg-secondary flex items-end gap-2 px-3 pt-1 pb-3">
            <textarea
              aria-label="Pesan"
              rows={1}
              value={text}
              maxLength={4000}
              placeholder="Ketik pesan"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="bg-card placeholder:text-muted-foreground [field-sizing:content] max-h-28 min-h-10 flex-1 resize-none rounded-3xl border-0 px-4 py-2.5 text-sm outline-none"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Kirim"
              disabled={pending || !text.trim()}
              className="size-10 rounded-full"
            >
              <Send />
            </Button>
          </form>
        </section>
      )}

      <Button
        type="button"
        aria-label={open ? "Tutup AI Assistant" : "Buka AI Assistant"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="shadow-popover fixed right-3 bottom-20 z-40 h-12 gap-2 rounded-full px-5 sm:right-5 sm:bottom-20"
      >
        {open ? <X /> : <Sparkles />}
        <span className="hidden sm:inline">AI Assistant</span>
      </Button>
    </>
  );
}
