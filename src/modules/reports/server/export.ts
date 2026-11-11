import ExcelJS from "exceljs";
import Papa from "papaparse";
import { safeCell } from "@/lib/csv";
import type { Report } from "@/modules/reports/server/reports";

/** CSV: semua seksi berurutan, dipisah baris kosong; baris pertama setiap seksi = judul. */
export function reportToCsv(r: Report): string {
  const parts = r.sections.map((s) =>
    Papa.unparse({ fields: s.columns, data: s.rows.map((row) => row.map(safeCell)) }),
  );
  const head = [`${r.title} — ${r.periodLabel}`, ...(r.note ? [r.note] : [])].map((l) =>
    Papa.unparse([[safeCell(l)]]),
  );
  return (
    "﻿" +
    [
      ...head,
      "",
      ...parts.flatMap((p, i) => [`${Papa.unparse([[safeCell(r.sections[i].title)]])}`, p, ""]),
    ].join("\n")
  );
}

/** XLSX: satu sheet per seksi (nama sheet maks. 31 karakter). */
export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  r.sections.forEach((s, i) => {
    const ws = wb.addWorksheet(`${i + 1}. ${s.title}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.addRow([`${r.title} — ${r.periodLabel}`]).font = { bold: true };
    if (r.note) ws.addRow([r.note]);
    ws.addRow([]);
    ws.addRow(s.columns).font = { bold: true };
    s.rows.forEach((row) => ws.addRow(row.map(safeCell)));
    ws.columns.forEach((c) => (c.width = 24));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
