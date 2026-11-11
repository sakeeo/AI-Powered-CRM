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

/** Export laporan dengan filter aktif; disembunyikan tanpa izin (server tetap menegakkan). */
export function ExportReportButton({ type }: { type: string }) {
  const can = useCan();
  const sp = useSearchParams();
  if (!can("export", "Report")) return null;
  const href = (format: string) => {
    const p = new URLSearchParams();
    for (const k of ["period", "owner", "team"]) if (sp.get(k)) p.set(k, sp.get(k)!);
    p.set("format", format);
    return `/api/reports/${type}/export?${p}`;
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
