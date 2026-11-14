"use client";

import { Car, DatabaseZap, Loader2, Plane } from "lucide-react";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import {
  DEMO_BUSINESSES,
  DEMO_BUSINESS_INFO,
  type DemoBusiness,
} from "@/modules/organizations/demo-businesses";
import { loadDemoWorkspace } from "@/modules/organizations/server/actions";

const BUSINESS_ICON = { dealer: Car, travel: Plane } as const;

/** Kartu Settings (khusus Owner): membuat workspace demo baru berisi data contoh lengkap. */
export function DemoWorkspaceCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [business, setBusiness] = useState<DemoBusiness>("dealer");

  function run() {
    start(async () => {
      const res = await loadDemoWorkspace({ business });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Workspace “${res.data.name}” dibuat. Beralih ke workspace demo…`);
      setOpen(false);
      await authClient.organization.setActive({ organizationId: res.data.organizationId });
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader className="block">
        <CardTitle>Workspace demo</CardTitle>
        <CardDescription>
          Buat workspace terpisah berisi data contoh lengkap sesuai jenis usaha untuk demo atau
          pelatihan. Hanya Owner yang dapat menjalankannya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setOpen(true)}>
          <DatabaseZap /> Load Demo Workspace
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Demo Workspace?</DialogTitle>
            <DialogDescription>
              Workspace baru akan dibuat dengan Anda sebagai Owner.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Pilih jenis usaha</legend>
            <div role="radiogroup" aria-label="Jenis usaha" className="grid gap-2 sm:grid-cols-2">
              {DEMO_BUSINESSES.map((b) => {
                const Icon = BUSINESS_ICON[b];
                const active = business === b;
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={pending}
                    onClick={() => setBusiness(b)}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-secondary ring-primary/30 ring-2"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full",
                        active ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {DEMO_BUSINESS_INFO[b].label}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {DEMO_BUSINESS_INFO[b].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
            <li>
              Berisi 19 anggota demo, tim, produk/paket, lead, contact, company, deal, quotation,
              aktivitas, feedback, dan laporan.
            </li>
            <li>
              Data workspace yang sedang aktif <b className="text-foreground">tidak diubah</b>.
            </li>
            <li>Anggota demo tidak bisa login dan tidak menerima email.</li>
            <li>Setelah selesai, Anda otomatis dipindahkan ke workspace demo.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={run} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Membuat data…
                </>
              ) : (
                "Buat workspace demo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
