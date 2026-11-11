import { leadSchema } from "@/modules/leads/schemas";

/** Kolom lead yang dapat diisi lewat impor, beserta sinonim header yang dikenali otomatis. */
export const LEAD_IMPORT_FIELDS = [
  { key: "name", label: "Nama", required: true, aliases: ["name", "nama", "full name", "lead"] },
  { key: "email", label: "Email", aliases: ["email", "e-mail", "surel"] },
  {
    key: "phone",
    label: "Telepon",
    aliases: ["phone", "telepon", "telp", "hp", "mobile", "whatsapp", "no hp"],
  },
  {
    key: "companyName",
    label: "Perusahaan",
    aliases: ["company", "companyname", "perusahaan", "organisasi", "organization"],
  },
  {
    key: "needs",
    label: "Kebutuhan",
    aliases: ["needs", "kebutuhan", "message", "pesan", "requirement"],
  },
  { key: "budget", label: "Budget", aliases: ["budget", "anggaran", "nilai"] },
  { key: "currency", label: "Mata uang", aliases: ["currency", "mata uang", "kurs"] },
  { key: "urgency", label: "Urgensi", aliases: ["urgency", "urgensi", "prioritas", "priority"] },
  { key: "notes", label: "Catatan", aliases: ["notes", "catatan", "note", "keterangan"] },
] as const;
export type LeadImportKey = (typeof LEAD_IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<LeadImportKey, string>>;

export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_BATCH_SIZE = 200;

/** Tebak pemetaan kolom CSV → field lead dari nama header. */
export function guessMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.trim().toLowerCase();
  const out: ColumnMapping = {};
  for (const f of LEAD_IMPORT_FIELDS) {
    const hit = headers.find((h) => (f.aliases as readonly string[]).includes(norm(h)));
    if (hit) out[f.key] = hit;
  }
  return out;
}

/** Terapkan pemetaan: baris CSV mentah → objek field lead (string). */
export function applyMapping(row: Record<string, string>, mapping: ColumnMapping) {
  const out: Record<string, string> = {};
  for (const f of LEAD_IMPORT_FIELDS) {
    const col = mapping[f.key];
    if (col && row[col] !== undefined) out[f.key] = row[col];
  }
  return out;
}

const URGENCY_ALIAS: Record<string, string> = {
  low: "low",
  rendah: "low",
  medium: "medium",
  sedang: "medium",
  high: "high",
  tinggi: "high",
};

/** Validasi satu baris dengan skema lead yang sama seperti form (satu sumber kebenaran). */
export function validateLeadRow(raw: Record<string, string>) {
  const urgency = raw.urgency?.trim().toLowerCase();
  const candidate = {
    ...raw,
    currency: raw.currency?.trim() ? raw.currency.trim().toUpperCase() : undefined,
    urgency: urgency ? (URGENCY_ALIAS[urgency] ?? urgency) : undefined,
  };
  return leadSchema.omit({ sourceId: true, ownerId: true }).safeParse(candidate);
}
