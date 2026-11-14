"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { FormActions } from "@/components/shared/form-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { deleteWorkspace } from "@/modules/organizations/server/actions";

/** Zona berbahaya (khusus Owner): hapus workspace aktif dengan konfirmasi mengetik namanya. */
export function DeleteWorkspaceCard({ orgName }: { orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim() === orgName.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    start(async () => {
      const res = await deleteWorkspace({ confirmName: typed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Workspace “${orgName}” dihapus`);
      setOpen(false);
      await authClient.organization.setActive({
        organizationId: res.data.nextOrganizationId,
      });
      router.replace(res.data.nextOrganizationId ? "/dashboard" : "/onboarding");
      router.refresh();
    });
  }

  return (
    <Card className="border-tone-red-border max-w-xl border">
      <CardHeader className="block">
        <CardTitle className="text-tone-red-ink">Zona berbahaya</CardTitle>
        <CardDescription>
          Hapus workspace “{orgName}”. Semua anggota langsung kehilangan akses. Hanya Owner yang
          dapat melakukannya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 /> Hapus workspace
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (!o) setTyped("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus workspace?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan dari aplikasi.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
              <li>
                Semua data di workspace ini (lead, contact, deal, quotation, aktivitas, dll.) tidak
                dapat diakses lagi oleh siapa pun.
              </li>
              <li>Webhook, kanal WhatsApp/email, reminder, dan sinkron Google berhenti.</li>
              <li>Undangan yang masih menunggu dibatalkan.</li>
              <li>
                Data tidak langsung terhapus dari database; pemulihan hanya dapat dilakukan oleh
                admin server.
              </li>
            </ul>
            <FormField id="confirm-workspace" label={`Ketik “${orgName}” untuk konfirmasi`}>
              <Input
                id="confirm-workspace"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={orgName}
              />
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={!matches || pending}>
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" /> Menghapus…
                  </>
                ) : (
                  "Hapus workspace ini"
                )}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
