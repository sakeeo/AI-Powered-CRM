import ExcelJS from "exceljs";
import Papa from "papaparse";
import { writeAudit } from "@/lib/audit";
import { safeCell } from "@/lib/csv";
import type { TenantContext } from "@/lib/context";
import { pickParam, type SearchParams } from "@/lib/list-params";
import { listCompaniesForExport } from "@/modules/companies/server/queries";
import { listContactsForExport } from "@/modules/contacts/server/queries";
import type { ExportEntity } from "@/modules/import-export/schemas";
import {
  LEAD_STATUS_LABEL,
  URGENCY_LABEL,
  type LeadStatus,
  type Urgency,
} from "@/modules/leads/constants";
import { listLeadsForExport } from "@/modules/leads/server/queries";

export const EXPORT_MAX_ROWS = 20_000;

type Dataset = { columns: string[]; rows: (string | number | boolean)[][] };

const date = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Kumpulkan data export sesuai filter aktif (query string yang sama dengan halaman daftar) & izin export. */
export async function buildDataset(
  ctx: TenantContext,
  entity: ExportEntity,
  sp: SearchParams,
): Promise<Dataset> {
  const q = pickParam(sp, "q");
  const owner = pickParam(sp, "owner");
  if (entity === "leads") {
    const rows = await listLeadsForExport(
      ctx,
      q,
      {
        status: pickParam(sp, "status"),
        sourceId: pickParam(sp, "source"),
        owner,
        archived: pickParam(sp, "archived") === "1",
      },
      EXPORT_MAX_ROWS,
    );
    return {
      columns: [
        "Nama",
        "Email",
        "Telepon",
        "Perusahaan",
        "Status",
        "Sumber",
        "Urgensi",
        "Budget",
        "Mata uang",
        "Kebutuhan",
        "Catatan",
        "Dibuat",
      ],
      rows: rows.map((r) =>
        [
          r.name,
          r.email,
          r.phone,
          r.companyName,
          LEAD_STATUS_LABEL[r.status as LeadStatus] ?? r.status,
          r.source?.name,
          r.urgency ? URGENCY_LABEL[r.urgency as Urgency] : "",
          r.budget ? r.budget.toFixed(2) : "",
          r.currency,
          r.needs,
          r.notes,
          date(r.createdAt),
        ].map(safeCell),
      ),
    };
  }
  if (entity === "contacts") {
    const rows = await listContactsForExport(ctx, q, owner, EXPORT_MAX_ROWS);
    return {
      columns: [
        "Nama",
        "Email",
        "Telepon",
        "Jabatan",
        "Perusahaan",
        "Kota",
        "Negara",
        "Catatan",
        "Dibuat",
      ],
      rows: rows.map((r) =>
        [
          r.name,
          r.email,
          r.phone,
          r.jobTitle,
          r.companies.map((c) => c.company.name).join("; "),
          r.city,
          r.country,
          r.notes,
          date(r.createdAt),
        ].map(safeCell),
      ),
    };
  }
  const rows = await listCompaniesForExport(ctx, q, owner, EXPORT_MAX_ROWS);
  return {
    columns: [
      "Nama",
      "Industri",
      "Website",
      "Email",
      "Telepon",
      "Alamat",
      "Kota",
      "Negara",
      "Catatan",
      "Dibuat",
    ],
    rows: rows.map((r) =>
      [
        r.name,
        r.industry,
        r.website,
        r.email,
        r.phone,
        r.address,
        r.city,
        r.country,
        r.notes,
        date(r.createdAt),
      ].map(safeCell),
    ),
  };
}

export async function renderCsv(data: Dataset): Promise<string> {
  // BOM agar Excel membaca UTF-8 dengan benar.
  return "﻿" + Papa.unparse({ fields: data.columns, data: data.rows });
}

export async function renderXlsx(data: Dataset, sheetName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(data.columns).font = { bold: true };
  data.rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function auditExport(
  ctx: TenantContext & { ip?: string | null },
  entity: ExportEntity,
  format: string,
  count: number,
) {
  await writeAudit(ctx, { action: "data.exported", entityType: entity, after: { format, count } });
}
