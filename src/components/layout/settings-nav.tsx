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
  { href: "/settings/pipelines", label: "Pipeline" },
  { href: "/settings/tags", label: "Tags", subject: "Tag" },
  { href: "/settings/custom-fields", label: "Custom Fields", subject: "CustomField" },
  { href: "/settings/quotations", label: "Quotation" },
  { href: "/settings/activity-templates", label: "Template Aktivitas" },
  { href: "/settings/automation", label: "Automation", subject: "Automation" },
  { href: "/settings/integrations", label: "Integrasi Saya" },
  { href: "/settings/connectors", label: "Connectors", subject: "Connector" },
  { href: "/settings/audit-log", label: "Audit Log", subject: "AuditLog" },
];

/** Sub-navigasi Settings memakai gaya tab segmen (design-system §5, pola tanpa padanan template). */
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
              "text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-3xl px-4 text-sm transition-colors outline-none focus-visible:ring-3",
              active && "bg-secondary text-primary font-medium",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
