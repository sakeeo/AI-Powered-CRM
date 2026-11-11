import { z } from "zod";

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const base = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  q: z.string().trim().max(100).optional().catch(undefined),
});

export type ListParams<S extends string = string> = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  sort: S;
  dir: "asc" | "desc";
  q?: string;
  orderBy: Record<string, "asc" | "desc">;
};

/**
 * Parse query string daftar (halaman, ukuran, sort, arah, pencarian) dengan whitelist kolom sort.
 * Nilai tidak valid jatuh ke default — tidak pernah melempar, tidak pernah menembus ke query mentah.
 */
export function parseListParams<S extends string>(
  sp: SearchParams,
  allowedSorts: readonly S[],
  defaultSort: S,
  defaultDir: "asc" | "desc" = "desc",
): ListParams<S> {
  const parsed = base.parse({
    page: first(sp.page),
    pageSize: first(sp.pageSize),
    dir: first(sp.dir) ?? defaultDir,
    q: first(sp.q) || undefined,
  });
  const rawSort = first(sp.sort);
  const sort = (allowedSorts as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as S)
    : defaultSort;
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize,
    sort,
    dir: parsed.dir,
    q: parsed.q,
    orderBy: { [sort]: parsed.dir },
  };
}

export function pickParam(sp: SearchParams, key: string): string | undefined {
  return first(sp[key]) || undefined;
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number };
