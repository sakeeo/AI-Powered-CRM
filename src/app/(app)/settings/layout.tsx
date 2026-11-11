import type { ReactNode } from "react";
import { SettingsNav } from "@/components/layout/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <SettingsNav />
      {children}
    </div>
  );
}
