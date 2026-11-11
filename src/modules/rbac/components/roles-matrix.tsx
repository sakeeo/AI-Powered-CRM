"use client";

import { Check, Minus, UserRound } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Grant } from "@/lib/abilities";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/roles";
import { cn } from "cn";

type Matrix = Record<string, Record<string, Grant>>;
const ACTION_LABEL: Record<string, string> = {
  view: "Lihat",
  create: "Buat",
  update: "Ubah",
  delete: "Hapus",
  export: "Export",
};
const SUBJECT_LABEL: Record<string, string> = {
  Organization: "Organisasi",
  Member: "Anggota",
  Team: "Tim",
  AuditLog: "Audit log",
  Connector: "Connector",
  Contact: "Contact",
  Company: "Company",
  Lead: "Lead",
  LeadSource: "Lead source",
  Deal: "Deal",
  Pipeline: "Pipeline",
  Activity: "Aktivitas & task",
  Product: "Produk",
  Quotation: "Quotation",
  Customer: "Customer",
  Feedback: "Feedback",
  Report: "Laporan",
  Notification: "Notifikasi",
};

function Cell({ grant }: { grant: Grant }) {
  if (grant === "all")
    return (
      <span className="text-tone-green-ink inline-flex" title="Diizinkan">
        <Check className="size-4" aria-label="Diizinkan" />
      </span>
    );
  if (grant === "own")
    return (
      <span className="text-tone-orange-ink inline-flex" title="Hanya data milik sendiri / tim">
        <UserRound className="size-4" aria-label="Hanya milik sendiri atau tim" />
      </span>
    );
  return (
    <span className="text-muted-foreground inline-flex" title="Tidak diizinkan">
      <Minus className="size-4" aria-label="Tidak diizinkan" />
    </span>
  );
}

export function RolesMatrix({ matrices }: { matrices: Record<Role, Matrix> }) {
  const [role, setRole] = useState<Role>("owner");
  const matrix = matrices[role];
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>
          Matriks izin tiap role. Role anggota ditetapkan di halaman Users & Teams. Izin ditegakkan
          di server.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Pilih role">
          {ROLES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              className={cn(
                "border-input bg-card focus-visible:ring-ring/50 h-8 rounded-[8px] border px-3 text-xs outline-none focus-visible:ring-3",
                role === r &&
                  "border-primary bg-primary text-primary-foreground shadow-[0_2px_5px_rgb(18_105_168/0.2)]",
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">{ROLE_DESCRIPTION[role]}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modul</TableHead>
              {Object.keys(ACTION_LABEL).map((a) => (
                <TableHead key={a} className="text-center">
                  {ACTION_LABEL[a]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(matrix).map((subject) => (
              <TableRow key={subject}>
                <TableCell className="font-medium">{SUBJECT_LABEL[subject] ?? subject}</TableCell>
                {Object.keys(ACTION_LABEL).map((a) => (
                  <TableCell key={a} className="text-center">
                    <Cell grant={matrix[subject][a]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1">
            <Check className="text-tone-green-ink size-3.5" /> Diizinkan
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="text-tone-orange-ink size-3.5" /> Hanya milik sendiri/tim
          </span>
          <span className="inline-flex items-center gap-1">
            <Minus className="size-3.5" /> Tidak diizinkan
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
