import type { ReactNode } from "react";

/** Layout halaman auth: panel primary (≥lg) + area form (design-system §5, Hero banner). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -bottom-40 size-[420px] rounded-full border border-white/10 shadow-[0_0_0_40px_rgb(255_255_255/0.03),0_0_0_90px_rgb(255_255_255/0.025)]" />
        <div className="relative">
          <strong className="text-xl font-bold tracking-tight">CRM</strong>
          <span className="text-sidebar-muted block text-xs">Sales Workspace</span>
        </div>
        <div className="relative max-w-md space-y-3">
          <h2 className="text-hero font-bold">Dari lead pertama hingga pelanggan setia.</h2>
          <p className="text-sm text-white/85">
            Kelola lead, deal, aktivitas, dan quotation dalam satu tempat — dengan AI yang selalu
            menunggu persetujuan Anda.
          </p>
        </div>
      </aside>
      <main className="bg-background flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
