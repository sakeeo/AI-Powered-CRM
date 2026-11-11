"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { isRole, ROLE_LABEL } from "@/lib/roles";

export function AcceptInvitation({
  invitationId,
  email,
  invitation,
}: {
  invitationId: string;
  email: string;
  invitation: { organizationName: string; role: string; inviterEmail: string } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(undefined);
    const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error || !data) {
      setBusy(false);
      return setError(
        "Undangan tidak dapat diterima. Pastikan Anda masuk dengan email yang diundang.",
      );
    }
    await authClient.organization.setActive({ organizationId: data.invitation.organizationId });
    router.replace("/dashboard");
    router.refresh();
  }

  if (!invitation) {
    return (
      <AuthCard
        title="Undangan tidak valid"
        description="Undangan tidak ditemukan, sudah kedaluwarsa, atau bukan untuk akun ini."
        footer={
          <Link href="/dashboard" className="text-primary hover:underline">
            Kembali
          </Link>
        }
      >
        <p className="text-muted-foreground text-label">Anda masuk sebagai {email}.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={`Bergabung ke ${invitation.organizationName}`}
      description={`${invitation.inviterEmail} mengundang Anda sebagai ${isRole(invitation.role) ? ROLE_LABEL[invitation.role] : invitation.role}.`}
    >
      {error && (
        <p
          role="alert"
          className="bg-tone-red-soft text-tone-red-ink text-label rounded-md px-3 py-2"
        >
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" onClick={accept} disabled={busy}>
        {busy ? "Memproses…" : "Terima undangan"}
      </Button>
    </AuthCard>
  );
}
