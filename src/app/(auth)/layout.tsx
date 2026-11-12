import type { ReactNode } from "react";

/** Layout halaman auth: satu kolom di tengah di atas latar primary (hijau); kartu form putih. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-primary relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
      {/* Aksen oranye (Loud ≤ 10% permukaan): lingkaran lembut + cincin tipis di sudut. */}
      <div
        aria-hidden
        className="bg-loud/90 pointer-events-none absolute -top-28 -left-28 size-72 rounded-full"
      />
      <div
        aria-hidden
        className="border-loud/60 pointer-events-none absolute -top-10 -left-10 size-72 rounded-full border-2"
      />
      <div
        aria-hidden
        className="border-loud/40 pointer-events-none absolute -right-24 -bottom-40 size-[420px] rounded-full border-2 shadow-[0_0_0_40px_rgb(255_255_255/0.03),0_0_0_90px_rgb(255_255_255/0.025)]"
      />
      <div
        aria-hidden
        className="bg-loud/80 pointer-events-none absolute right-[12%] bottom-[14%] size-4 rounded-full"
      />
      <div className="relative w-full max-w-md sm:max-w-lg">{children}</div>
    </main>
  );
}
