"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useCan } from "@/components/providers/ability-provider";
import type { SubjectName } from "@/lib/abilities";

export const SETTINGS_LINKS: { href: string; label: string; subject?: SubjectName }[] = [
  { href: "/settings", label: "Organisasi" },
  { href: "/settings/roles", label: "Roles & Permissions" },
  { href: "/settings/lead-sources", label: "Lead Source" },
  { href: "/settings/connectors", label: "Connectors", subject: "Connector" },
  { href: "/settings/audit-log", label: "Audit Log", subject: "AuditLog" },
];

/** Sub-navigasi Settings memakai gaya tab segmen (design-system §5). */
export function SettingsNav({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  const can = useCan();
  return (
    <nav aria-label="Pengaturan" className="flex flex-wrap gap-1.5">
      {SETTINGS_LINKS.filter(
        (l) => !hidden.includes(l.href) && (!l.subject || can("view", l.subject)),
      ).map((l) => {
        const active = l.href === "/settings" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-input bg-card text-foreground focus-visible:ring-ring/50 h-8 rounded-[8px] border px-3 text-xs leading-[30px] transition-colors outline-none focus-visible:ring-3",
              active &&
                "border-primary bg-primary text-primary-foreground shadow-[0_2px_5px_rgb(18_105_168/0.2)]",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
