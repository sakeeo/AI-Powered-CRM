import type { ReactNode } from "react";

/** Alur satu kolom untuk pengguna yang sudah login tetapi belum punya organisasi aktif. */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
