import type { ReactNode } from "react";

/** Layout halaman auth: satu kolom di tengah di atas latar primary (hijau); kartu form putih. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-primary relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -bottom-40 size-[420px] rounded-full border border-white/10 shadow-[0_0_0_40px_rgb(255_255_255/0.03),0_0_0_90px_rgb(255_255_255/0.025)]" />
      <div className="relative w-full max-w-md space-y-6 sm:max-w-lg">
        <div className="text-center text-white">
          <strong className="text-xl font-bold tracking-tight">CRM</strong>
          <span className="text-sidebar-muted block text-xs">Sales Workspace</span>
        </div>
        {children}
      </div>
    </main>
  );
}
