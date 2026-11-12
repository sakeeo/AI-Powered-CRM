"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 1024 * 1024;

/** Unggah / ganti / hapus logo organisasi (PNG, JPG, WebP; maks. 1 MB). */
export function LogoUploader({
  name,
  logoUrl,
  canEdit,
}: {
  name: string;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(logoUrl);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Ukuran logo maksimal 1 MB");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/organization/logo", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error?.message ?? "Gagal mengunggah logo");
      setUrl(json.url);
      toast.success("Logo disimpan");
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/organization/logo", { method: "DELETE" });
      if (!res.ok) return toast.error("Gagal menghapus logo");
      setUrl(null);
      toast.success("Logo dihapus");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border text-2xl font-semibold uppercase">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Logo ${name}`} className="size-full object-contain" />
        ) : (
          name.charAt(0) || "?"
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Logo organisasi</p>
        <p className="text-muted-foreground text-xs">PNG, JPG, atau WebP. Maksimal 1 MB.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Pilih file logo"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus /> {url ? "Ganti logo" : "Tambah logo"}
            </Button>
            {url && (
              <Button type="button" variant="destructive" disabled={busy} onClick={remove}>
                <Trash2 /> Hapus
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
