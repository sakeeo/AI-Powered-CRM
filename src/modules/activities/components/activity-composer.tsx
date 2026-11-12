"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  type ActivityLink,
  type ActivityType,
} from "@/modules/activities/constants";
import { AiAssist } from "@/modules/activities/components/ai-assist";
import { createActivity } from "@/modules/activities/server/actions";

export type OwnerOption = { userId: string; name: string };
export type TemplateOption = {
  id: string;
  name: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  dueInDays: number | null;
};

/** Tenggat relatif → nilai datetime-local pada zona waktu organisasi (09:00). */
function dueFromDays(days: number | null, timezone: string) {
  if (days === null) return "";
  const d = new Date(Date.now() + days * 86_400_000);
  const local = d.toLocaleString("sv-SE", { timeZone: timezone }); // YYYY-MM-DD HH:MM:SS
  return `${local.slice(0, 10)}T09:00`;
}

/** Quick composer: catat call/meeting/email/note atau buat task, dengan catatan rich text. */
export function ActivityComposer({
  link,
  owners,
  canAssignOwner,
  templates = [],
  timezone = "UTC",
}: {
  link: ActivityLink;
  owners: OwnerOption[];
  canAssignOwner: boolean;
  templates?: TemplateOption[];
  timezone?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [editorKey, setEditorKey] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createActivity({ type, subject, body, dueLocal: due, ownerId, ...link });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(type === "task" ? "Task dibuat" : "Aktivitas dicatat");
      setErrors({});
      setSubject("");
      setBody("");
      setDue("");
      setEditorKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate aria-label="Tambah aktivitas">
      <div role="radiogroup" aria-label="Jenis aktivitas" className="flex flex-wrap gap-1.5">
        {ACTIVITY_TYPES.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            role="radio"
            aria-checked={type === t}
            variant={type === t ? "default" : "outline"}
            onClick={() => setType(t)}
          >
            {ACTIVITY_TYPE_LABEL[t]}
          </Button>
        ))}
      </div>
      {templates.length > 0 && (
        <FormField id="act-template" label="Pakai template">
          <SelectField
            id="act-template"
            value=""
            placeholder="Pilih template…"
            onChange={(id) => {
              const t = templates.find((x) => x.id === id);
              if (!t) return;
              setType(t.type);
              setSubject(t.subject);
              setBody(t.body ?? "");
              setDue(dueFromDays(t.dueInDays, timezone));
              setEditorKey((k) => k + 1);
              toast.success(`Template “${t.name}” dimuat — periksa lalu simpan`);
            }}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        </FormField>
      )}
      <AiAssist
        link={link}
        onSummary={(html) => {
          setBody(html);
          setEditorKey((k) => k + 1);
        }}
      />
      <FormField id="act-subject" label="Judul" error={errors.subject}>
        <Input id="act-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FormField>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Catatan</span>
        <RichTextEditor key={editorKey} value={body} onChange={setBody} label="Catatan aktivitas" />
        {errors.body && (
          <p role="alert" className="text-tone-red-ink text-xs">
            {errors.body}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="act-due"
          label={type === "task" ? "Tenggat" : "Jadwal (kosongkan bila sudah terjadi)"}
          error={errors.dueLocal}
        >
          <Input
            id="act-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </FormField>
        {canAssignOwner && (
          <FormField id="act-owner" label="Ditugaskan ke">
            <SelectField
              id="act-owner"
              value={ownerId}
              onChange={setOwnerId}
              noneLabel="Saya"
              options={owners.map((o) => ({ value: o.userId, label: o.name }))}
            />
          </FormField>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : type === "task" ? "Buat task" : "Catat"}
      </Button>
    </form>
  );
}
