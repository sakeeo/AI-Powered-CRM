"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DuplicateMatch } from "@/modules/duplicates/server/detect";

const REASON: Record<string, string> = {
  email: "email sama",
  phone: "telepon sama",
  name_company: "nama + perusahaan sama",
};
const ENTITY: Record<string, string> = { lead: "Lead", contact: "Contact", company: "Company" };

/** Peringatan kemungkinan duplikat — pengguna yang memutuskan (tidak ada auto-merge). */
export function DuplicateWarning({
  matches,
  onConfirm,
  onCancel,
  busy,
}: {
  matches: DuplicateMatch[];
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="alert"
      className="bg-tone-orange-soft border-tone-orange-border space-y-3 rounded-lg border p-3"
    >
      <p className="text-tone-orange-ink flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-4" /> Kemungkinan duplikat ditemukan
      </p>
      <ul className="text-label space-y-1.5">
        {matches.map((m) => (
          <li key={`${m.entity}-${m.id}`}>
            <Link
              href={m.href}
              target="_blank"
              className="text-primary font-medium hover:underline"
            >
              {m.name}
            </Link>{" "}
            <span className="text-muted-foreground">
              · {ENTITY[m.entity]} · {m.reasons.map((r) => REASON[r]).join(", ")}
              {m.detail ? ` · ${m.detail}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
          Tetap simpan
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Periksa dulu
        </Button>
      </div>
    </div>
  );
}
