"use client";

import { Trash2, Users } from "lucide-react";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/providers/ability-provider";
import { RowAction } from "@/components/shared/row-action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeam, deleteTeam, setTeamMembers } from "@/modules/organizations/server/actions";

export type TeamRow = { id: string; name: string; userIds: string[] };
export type PersonOption = { userId: string; name: string };

function MembersDialog({
  team,
  people,
  onClose,
}: {
  team: TeamRow;
  people: PersonOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(new Set(team.userIds));
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      const res = await setTeamMembers({ teamId: team.id, userIds: [...selected] });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Anggota tim disimpan");
      onClose();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anggota tim {team.name}</DialogTitle>
          <DialogDescription>Pilih anggota aktif yang tergabung di tim ini.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`tm-${p.userId}`}
                checked={selected.has(p.userId)}
                onCheckedChange={(c) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (c) next.add(p.userId);
                    else next.delete(p.userId);
                    return next;
                  })
                }
              />
              <Label htmlFor={`tm-${p.userId}`}>{p.name}</Label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamsPanel({ teams, people }: { teams: TeamRow[]; people: PersonOption[] }) {
  const can = useCan();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [pending, start] = useTransition();
  const nameOf = new Map(people.map((p) => [p.userId, p.name]));

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createTeam({ name });
      if (!res.ok) {
        toast.error(res.fieldErrors?.name ?? res.error);
        return;
      }
      toast.success("Tim dibuat");
      setName("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tim</CardTitle>
          <CardDescription>
            Kelompokkan anggota; Sales Manager dapat mengelola data timnya.
          </CardDescription>
        </div>
        {can("create", "Team") && (
          <CardAction>
            <form onSubmit={add} className="flex gap-2">
              <Input
                aria-label="Nama tim baru"
                placeholder="Nama tim"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-40"
                required
              />
              <Button type="submit" disabled={pending}>
                Buat tim
              </Button>
            </form>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-muted-foreground text-label">Belum ada tim.</p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {teams.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {t.userIds.length
                      ? t.userIds.map((id) => nameOf.get(id) ?? "—").join(", ")
                      : "Belum ada anggota"}
                  </div>
                </div>
                {can("update", "Team") && (
                  <div className="flex gap-2">
                    <RowAction
                      icon={Users}
                      label="Atur anggota"
                      variant="outline"
                      onClick={() => setEditing(t)}
                    />
                    {can("delete", "Team") && (
                      <RowAction
                        icon={Trash2}
                        label="Hapus"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await deleteTeam({ id: t.id });
                            if (!res.ok) toast.error(res.error);
                            else toast.success("Tim dihapus");
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && (
        <MembersDialog
          key={editing.id}
          team={editing}
          people={people}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
