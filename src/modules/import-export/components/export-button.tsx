"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCan } from "@/components/providers/ability-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportEntity } from "@/modules/import-export/schemas";

const SUBJECT = { leads: "Lead", contacts: "Contact", companies: "Company" } as const;
const FILTER_KEYS = ["q", "status", "source", "owner", "archived"];

/** Export dengan filter aktif di URL halaman; disembunyikan bila peran tanpa izin export (server tetap menegakkan). */
export function ExportButton({ entity }: { entity: ExportEntity }) {
  const can = useCan();
  const sp = useSearchParams();
  if (!can("export", SUBJECT[entity])) return null;
  const href = (format: "csv" | "xlsx") => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) if (sp.get(k)) p.set(k, sp.get(k)!);
    p.set("format", format);
    return `/api/export/${entity}?${p}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href("csv")} download>
            CSV (.csv)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
