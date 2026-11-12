"use client";

import { Bookmark, Star, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
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
import {
  VIEW_VISIBILITIES,
  VIEW_VISIBILITY_LABEL,
  type CustomEntity,
  type ViewVisibility,
} from "@/modules/customization/constants";
import {
  createSavedView,
  deleteSavedView,
  updateSavedView,
} from "@/modules/customization/server/actions";
import type { SavedViewDto } from "@/modules/customization/server/queries";

const NONE = "__all__";

/** Parameter yang membentuk sebuah tampilan: semua query string kecuali halaman dan penanda `all`. */
function currentParams(sp: URLSearchParams) {
  const out: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (k !== "page" && k !== "all" && v !== "") out[k] = v;
  });
  return out;
}

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

/**
 * Saved views tabel: pilih tampilan tersimpan, simpan filter/sort aktif sebagai tampilan baru
 * (pribadi, tim, atau seluruh organisasi), jadikan bawaan, atau hapus.
 */
export function SavedViewsBar({
  entity,
  views,
  teams,
  canShareOrg,
}: {
  entity: CustomEntity;
  views: SavedViewDto[];
  teams: { id: string; name: string }[];
  canShareOrg: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ViewVisibility>("personal");
  const [teamId, setTeamId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [pending, start] = useTransition();

  const now = currentParams(new URLSearchParams(sp.toString()));
  const active = views.find((v) => same(v.params, now));
  const visibilities = VIEW_VISIBILITIES.filter(
    (v) => (v !== "team" || teams.length > 0) && (v !== "organization" || canShareOrg),
  );

  function apply(id: string) {
    if (id === NONE || !id) {
      router.push(`${pathname}?all=1`);
      return;
    }
    const v = views.find((x) => x.id === id);
    if (v) router.push(`${pathname}?${new URLSearchParams(v.params).toString()}`);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createSavedView({
        entityType: entity,
        name,
        visibility,
        teamId: visibility === "team" ? teamId : undefined,
        params: now,
        isDefault,
      });
      if (!res.ok) {
        toast.error(res.fieldErrors?.name ?? res.error);
        return;
      }
      toast.success("Tampilan disimpan");
      setOpen(false);
      setName("");
      setIsDefault(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48">
        <SelectField
          id={`views-${entity}`}
          value={active?.id ?? ""}
          onChange={apply}
          placeholder="Tampilan tersimpan"
          noneLabel="Semua data (tanpa filter)"
          options={views.map((v) => ({
            value: v.id,
            label: `${v.isDefault ? "★ " : ""}${v.name}${v.mine ? "" : " (dibagikan)"}`,
          }))}
        />
      </div>
      {active && active.mine && (
        <>
          <Button
            variant="outline"
            size="icon"
            aria-label={
              active.isDefault ? "Lepas sebagai tampilan bawaan" : "Jadikan tampilan bawaan"
            }
            title={active.isDefault ? "Lepas sebagai tampilan bawaan" : "Jadikan tampilan bawaan"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateSavedView({ id: active.id, isDefault: !active.isDefault });
                if (!res.ok) toast.error(res.error);
                else router.refresh();
              })
            }
          >
            <Star className={active.isDefault ? "fill-current" : ""} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Hapus tampilan"
            title="Hapus tampilan"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteSavedView({ id: active.id });
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Tampilan dihapus");
                  router.push(`${pathname}?all=1`);
                }
              })
            }
          >
            <Trash2 />
          </Button>
        </>
      )}
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Bookmark /> Simpan tampilan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan tampilan</DialogTitle>
            <DialogDescription>
              Menyimpan filter, pencarian, urutan, dan ukuran halaman yang sedang aktif.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4" noValidate>
            <FormField id="view-name" label="Nama tampilan">
              <Input
                id="view-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField id="view-visibility" label="Dibagikan ke">
              <SelectField
                id="view-visibility"
                value={visibility}
                onChange={(v) => setVisibility(v as ViewVisibility)}
                options={visibilities.map((v) => ({ value: v, label: VIEW_VISIBILITY_LABEL[v] }))}
              />
            </FormField>
            {visibility === "team" && (
              <FormField id="view-team" label="Tim">
                <SelectField
                  id="view-team"
                  value={teamId}
                  onChange={setTeamId}
                  placeholder="Pilih tim"
                  options={teams.map((t) => ({ value: t.id, label: t.name }))}
                />
              </FormField>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="view-default"
                checked={isDefault}
                onCheckedChange={(c) => setIsDefault(c === true)}
              />
              <Label htmlFor="view-default">Jadikan tampilan bawaan saya</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending || name.trim().length < 2}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
