"use client";

import { UserCheck, UserX, X } from "lucide-react";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { Badge } from "@/components/ui/badge";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormField } from "@/components/shared/form-field";
import { isRole, ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import {
  changeMemberRole,
  inviteMember,
  revokeInvitation,
  setMemberActive,
} from "@/modules/organizations/server/actions";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
export type InvitationRow = { id: string; email: string; role: string | null; expiresAt: Date };

function InviteDialog({ actorRole }: { actorRole: Role }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales_rep");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const roles = ROLES.filter((r) => r !== "owner" || actorRole === "owner");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await inviteMember({ email, role });
      if (!res.ok) {
        setError(res.fieldErrors?.email ?? res.error);
        return;
      }
      toast.success(`Undangan dikirim ke ${email}`);
      setOpen(false);
      setEmail("");
      setError(undefined);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Undang anggota</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Undang anggota</DialogTitle>
            <DialogDescription>Undangan berlaku 7 hari dan dikirim lewat email.</DialogDescription>
          </DialogHeader>
          <FormField id="invite-email" label="Email" error={error}>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
            />
          </FormField>
          <FormField id="invite-role" label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim undangan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MembersPanel({
  members,
  invitations,
  currentUserId,
  actorRole,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  actorRole: Role;
}) {
  const can = useCan();
  const canManage = can("update", "Member");
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else toast.success(ok);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Anggota</CardTitle>
          <CardDescription>{members.filter((m) => m.active).length} anggota aktif</CardDescription>
        </div>
        {can("create", "Member") && (
          <CardAction>
            <InviteDialog actorRole={actorRole} />
          </CardAction>
        )}
      </CardHeader>
      <div className="p-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const self = m.userId === currentUserId;
              const locked = self || (m.role === "owner" && actorRole !== "owner");
              return (
                <TableRow key={m.id} className={m.active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">
                      {m.name}{" "}
                      {self && <span className="text-muted-foreground text-xs">(Anda)</span>}
                    </div>
                    <div className="text-muted-foreground text-xs">{m.email}</div>
                  </TableCell>
                  <TableCell>
                    {canManage && !locked ? (
                      <Select
                        value={m.role}
                        disabled={pending}
                        onValueChange={(role) =>
                          run(
                            () => changeMemberRole({ memberId: m.id, role: role as Role }),
                            "Role diubah",
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-44" aria-label={`Role ${m.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.filter((r) => r !== "owner" || actorRole === "owner").map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>{isRole(m.role) ? ROLE_LABEL[m.role] : m.role}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.active ? "secondary" : "outline"}>
                      {m.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {!locked && (
                        <RowAction
                          icon={m.active ? UserX : UserCheck}
                          label={m.active ? "Nonaktifkan" : "Aktifkan"}
                          variant={m.active ? "destructive" : "outline"}
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setMemberActive({ memberId: m.id, active: !m.active }),
                              m.active ? "Anggota dinonaktifkan" : "Anggota diaktifkan",
                            )
                          }
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {invitations.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 text-sm font-semibold">Undangan tertunda</h4>
            <ul className="divide-border divide-y rounded-lg border">
              {invitations.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm">{i.email}</div>
                    <div className="text-muted-foreground text-xs">
                      {i.role && isRole(i.role) ? ROLE_LABEL[i.role] : i.role} · berlaku hingga{" "}
                      {new Date(i.expiresAt).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                  {can("create", "Member") && (
                    <RowAction
                      icon={X}
                      label="Batalkan"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => revokeInvitation({ id: i.id }), "Undangan dibatalkan")
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
