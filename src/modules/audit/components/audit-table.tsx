import Link from "next/link";
import { PageSizeSelect } from "@/components/shared/data-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/list-params";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { listAuditLogs } from "@/modules/audit/server/queries";

type Data = Awaited<ReturnType<typeof listAuditLogs>>;

function Diff({ before, after }: { before: unknown; after: unknown }) {
  if (before == null && after == null) return <span className="text-muted-foreground">—</span>;
  return (
    <details className="text-xs">
      <summary className="text-primary cursor-pointer">Lihat</summary>
      <pre className="bg-muted mt-1 max-w-xs overflow-x-auto rounded p-2 text-[11px]">
        {JSON.stringify({ before, after }, null, 1)}
      </pre>
    </details>
  );
}

export function AuditTable({
  data,
  page,
  pageSize,
  entityType,
  timeZone,
}: {
  data: Data;
  page: number;
  pageSize: number;
  entityType?: string;
  timeZone: string;
}) {
  const qs = (p: number, t = entityType) => {
    const params = new URLSearchParams();
    if (t) params.set("type", t);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/settings/audit-log${s ? `?${s}` : ""}`;
  };
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>
          Jejak perubahan penting: siapa, apa, kapan, dan nilai sebelum/sesudah. Hanya dapat dibaca.
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[undefined, ...data.entityTypes].map((t) => (
              <Link
                key={t ?? "all"}
                href={qs(1, t)}
                className={`border-input h-7 rounded-[8px] border px-2.5 text-xs leading-[26px] ${
                  t === entityType ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                }`}
              >
                {t ?? "Semua"}
              </Link>
            ))}
          </div>
          <div className="text-xs">
            <PageSizeSelect pageSize={pageSize} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Perubahan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  Belum ada catatan audit.
                </TableCell>
              </TableRow>
            )}
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                    timeZone,
                  }).format(r.createdAt)}
                </TableCell>
                <TableCell>{r.actor}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.action}</Badge>
                </TableCell>
                <TableCell>{r.entityType}</TableCell>
                <TableCell className="text-muted-foreground">{r.ip ?? "—"}</TableCell>
                <TableCell>
                  <Diff before={r.before} after={r.after} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {data.total} catatan · halaman {page} dari {data.pages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={qs(page - 1)} aria-disabled={page <= 1}>
                Sebelumnya
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= data.pages}>
              <Link href={qs(page + 1)} aria-disabled={page >= data.pages}>
                Berikutnya
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
