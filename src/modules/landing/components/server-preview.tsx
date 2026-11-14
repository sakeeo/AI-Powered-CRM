import { Building2, DatabaseBackup, HardDrive, Lock, Server, ShieldCheck } from "lucide-react";

/**
 * Ilustrasi statis untuk hero: aplikasi tampil dengan domain & brand klien, berjalan di server milik klien.
 * Bukan data nyata; nama domain hanya contoh.
 */
export function ServerPreview() {
  const stack = [
    { icon: HardDrive, label: "Database pelanggan" },
    { icon: DatabaseBackup, label: "Backup terenkripsi" },
    { icon: ShieldCheck, label: "Akses per peran & audit log" },
  ];
  return (
    <figure
      aria-label="Ilustrasi Kerabat CRM berjalan di server milik perusahaan Anda"
      className="mx-auto w-full max-w-md text-left"
    >
      {/* Jendela browser dengan domain milik klien */}
      <div className="bg-card text-card-foreground shadow-popover overflow-hidden rounded-md">
        <div className="bg-muted flex items-center gap-2 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="bg-loud/70 size-2.5 rounded-full" />
            <span className="bg-tone-orange size-2.5 rounded-full" />
            <span className="bg-tone-green size-2.5 rounded-full" />
          </span>
          <span className="bg-card text-muted-foreground flex flex-1 items-center gap-1.5 rounded-3xl px-3 py-1 text-xs">
            <Lock className="text-tone-green-ink size-3" />
            crm.perusahaan-anda.com
          </span>
        </div>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-2xl">
            <Building2 className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">CRM Perusahaan Anda</p>
            <p className="text-muted-foreground text-xs">nama, logo & warna brand Anda</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 py-4">
          {[
            ["Lead", "Pipeline"],
            ["Deal", "Kanban"],
            ["AI", "Tanya CRM"],
          ].map(([t, d]) => (
            <div key={t} className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-muted-foreground text-[11px]">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Server milik klien */}
      <div className="bg-primary-foreground/10 border-primary-foreground/20 mt-4 rounded-md border p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Server className="size-4" /> Server / VPS milik Anda
        </p>
        <ul className="space-y-2">
          {stack.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="bg-primary-foreground/10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
            >
              <Icon className="size-4 shrink-0" /> {label}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-primary-foreground/70 mt-2 text-center text-[11px]">
        Ilustrasi — domain hanya contoh
      </figcaption>
    </figure>
  );
}
