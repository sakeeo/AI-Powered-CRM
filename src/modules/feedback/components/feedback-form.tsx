"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { FormActions } from "@/components/shared/form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABEL } from "@/modules/feedback/schemas";
import { createFeedback } from "@/modules/feedback/server/actions";

type Opt = { id: string; name: string };

/** Catat feedback/complaint. `fixed` mengunci customer (dipakai dari halaman Customer 360). */
export function FeedbackForm({
  contacts,
  companies,
  fixed,
  onDone,
}: {
  contacts: Opt[];
  companies: Opt[];
  fixed?: { contactId?: string; companyId?: string };
  onDone: () => void;
}) {
  const [type, setType] = useState<"feedback" | "complaint">("feedback");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contactId, setContactId] = useState(fixed?.contactId ?? "");
  const [companyId, setCompanyId] = useState(fixed?.companyId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createFeedback({ type, subject, body, contactId, companyId });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success(type === "complaint" ? "Complaint dicatat" : "Feedback dicatat");
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormField id="fb-type" label="Jenis">
        <SelectField
          id="fb-type"
          value={type}
          onChange={(v) => setType(v as "feedback" | "complaint")}
          options={FEEDBACK_TYPES.map((t) => ({ value: t, label: FEEDBACK_TYPE_LABEL[t] }))}
        />
      </FormField>
      <FormField id="fb-subject" label="Judul" error={errors.subject}>
        <Input id="fb-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FormField>
      <FormField id="fb-body" label="Detail" error={errors.body}>
        <Textarea id="fb-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </FormField>
      {!fixed && (
        <>
          <FormField id="fb-contact" label="Contact" error={errors.contactId}>
            <SelectField
              id="fb-contact"
              value={contactId}
              onChange={setContactId}
              noneLabel="—"
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
          </FormField>
          <FormField id="fb-company" label="Company">
            <SelectField
              id="fb-company"
              value={companyId}
              onChange={setCompanyId}
              noneLabel="—"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
          </FormField>
        </>
      )}
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </FormActions>
    </form>
  );
}
