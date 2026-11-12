import { AbilityBuilder, createMongoAbility, subject, type MongoAbility } from "@casl/ability";
import type { Role } from "@/lib/roles";

export const ACTIONS = ["view", "create", "update", "delete", "export", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

/** Subjek yang dilindungi. Tambahkan di sini saat ada entitas baru, lalu perbarui matriks di bawah. */
export const SUBJECTS = [
  "Organization",
  "Member",
  "Team",
  "AuditLog",
  "Connector",
  "Contact",
  "Company",
  "Lead",
  "LeadSource",
  "Deal",
  "Pipeline",
  "Activity",
  "Product",
  "Quotation",
  "Customer",
  "Feedback",
  "Report",
  "Notification",
  "Tag",
  "CustomField",
] as const;
export type SubjectName = (typeof SUBJECTS)[number];

export type AppAbility = MongoAbility<[Action, SubjectName | "all" | object]>;

export type AbilityInput = {
  role: Role;
  userId: string;
  /** Id user yang satu tim dengan pengguna (termasuk dirinya) — dipakai Sales Manager. */
  teamUserIds?: string[];
};

/** Entitas yang dimiliki user (kolom `ownerId`) — dasar kondisi kepemilikan. */
const OWNED: SubjectName[] = ["Lead", "Deal", "Activity", "Quotation"];
/** Data referensi bersama: semua anggota boleh melihat; mengubah dibatasi pemilik. */
const SHARED: SubjectName[] = ["Contact", "Company", "Customer", "Feedback"];

/**
 * Matriks izin per role (PRD §2.1). Satu-satunya definisi izin bisnis —
 * dipakai server (assertCan/scopeWhere) dan UI (sembunyikan aksi).
 *
 * | Role          | Ringkasan                                                                     |
 * | owner         | manage semua                                                                  |
 * | admin         | manage semua kecuali menghapus organisasi                                     |
 * | sales_manager | lihat semua data bisnis; ubah/hapus data milik sendiri & anggota timnya;       |
 * |               | kelola pipeline & produk; laporan + export                                    |
 * | sales_rep     | lihat/ubah/hapus lead, deal, aktivitas, quotation milik sendiri;              |
 * |               | lihat data referensi bersama; tidak bisa export                               |
 * | viewer        | hanya view (data bisnis + laporan)                                            |
 */
export function defineAbilityFor({ role, userId, teamUserIds = [] }: AbilityInput): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const teamIds = Array.from(new Set([userId, ...teamUserIds]));

  switch (role) {
    case "owner":
      can("manage", "all");
      break;
    case "admin":
      can("manage", "all");
      cannot("delete", "Organization");
      break;
    case "sales_manager":
      can("view", [...OWNED, ...SHARED, "Product", "Pipeline", "LeadSource", "Team", "Member"]);
      can("create", [...OWNED, ...SHARED, "Product"]);
      can(["update", "delete"], [...OWNED, ...SHARED], { ownerId: { $in: teamIds } });
      can(["update", "create"], "Pipeline");
      can(["update", "create", "delete"], "Product");
      can(["view", "export"], "Report");
      can("export", [...OWNED, ...SHARED]);
      can("view", "Notification");
      can("view", ["Tag", "CustomField"]);
      can(["create", "update"], "Tag");
      break;
    case "sales_rep":
      can("view", OWNED, { ownerId: userId });
      can("create", OWNED);
      can(["update", "delete"], OWNED, { ownerId: userId });
      can("view", [...SHARED, "Product", "Pipeline", "LeadSource", "Team", "Member"]);
      can("create", SHARED);
      can(["update", "delete"], SHARED, { ownerId: userId });
      can("view", "Report");
      can("view", "Notification");
      can("view", ["Tag", "CustomField"]);
      can("create", "Tag");
      break;
    case "viewer":
      can("view", [
        ...OWNED,
        ...SHARED,
        "Product",
        "Pipeline",
        "LeadSource",
        "Team",
        "Member",
        "Report",
        "Tag",
        "CustomField",
      ]);
      can("view", "Notification");
      break;
  }
  return build({
    detectSubjectType: (o) =>
      (o as { __caslSubjectType__?: SubjectName }).__caslSubjectType__ ?? (o as never),
  });
}

/** Tandai objek sebagai instans subjek agar kondisi (ownerId, dst.) dievaluasi. */
/**
 * CASL `subject()` MENAMBAH properti tak-enumerable `__caslSubjectType__` pada objek yang diberikan.
 * React menolak objek seperti itu sebagai props Client Component ("Only plain objects…"), sehingga
 * kita menandai SALINAN dangkal — objek asli tetap polos dan aman dikirim ke client.
 */
export const asSubject = <T extends object>(type: SubjectName, obj: T) => subject(type, { ...obj });

type Query = Record<string, unknown>;

function toPrisma(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toPrisma);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Query).map(([k, v]) => [k === "$in" ? "in" : k, toPrisma(v)]),
    );
  }
  return value;
}

/**
 * Terjemahkan kondisi ability menjadi filter Prisma `where` untuk query daftar.
 * - `null`  → tidak punya akses sama sekali (jangan query)
 * - `{}`    → akses ke semua record tenant
 * - `{OR: [...]}` → akses terbatas (mis. hanya milik sendiri)
 */
export function abilityToWhere(
  ability: AppAbility,
  action: Action,
  type: SubjectName,
): Query | null {
  const branches: Query[] = [];
  // rulesFor mengurutkan dari prioritas tertinggi (rule terakhir didefinisikan) ke terendah.
  for (const rule of ability.rulesFor(action, type)) {
    const conditions = rule.conditions as Query | undefined;
    if (rule.inverted) {
      if (conditions) throw new Error("cannot() bersyarat belum didukung oleh abilityToWhere");
      break; // larangan tanpa syarat memutus rule berprioritas lebih rendah
    }
    if (!conditions) return {};
    branches.push(toPrisma(conditions) as Query);
  }
  return branches.length ? { OR: branches } : null;
}

export type Grant = "all" | "own" | "none";

/**
 * Matriks izin untuk ditampilkan (Settings → Roles & Permissions) dan diuji.
 * "own" = diizinkan hanya dengan syarat kepemilikan/tim. Dihasilkan dari defineAbilityFor,
 * sehingga tidak mungkin berbeda dari penegakan sebenarnya.
 */
export function permissionMatrix(
  role: Role,
): Record<SubjectName, Record<Exclude<Action, "manage">, Grant>> {
  const ability = defineAbilityFor({ role, userId: "00000000-0000-0000-0000-000000000000" });
  const actions = ACTIONS.filter((a): a is Exclude<Action, "manage"> => a !== "manage");
  const matrix = {} as Record<SubjectName, Record<Exclude<Action, "manage">, Grant>>;
  for (const subjectName of SUBJECTS) {
    matrix[subjectName] = {} as Record<Exclude<Action, "manage">, Grant>;
    for (const action of actions) {
      if (!ability.can(action, subjectName)) {
        matrix[subjectName][action] = "none";
        continue;
      }
      const unconditional = ability
        .rulesFor(action, subjectName)
        .find((r) => !r.inverted && !r.conditions);
      matrix[subjectName][action] = unconditional ? "all" : "own";
    }
  }
  return matrix;
}
