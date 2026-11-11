import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/** Role organisasi (PRD §2.1). Disimpan di `members.role`. */
export const ROLES = ["owner", "admin", "sales_manager", "sales_rep", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Representative",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Akses penuh terhadap organisasi dan seluruh konfigurasi.",
  admin: "Mengelola pengguna, konfigurasi, dan data.",
  sales_manager: "Mengelola tim, assignment, pipeline, dan laporan tim.",
  sales_rep: "Mengelola data yang dimiliki atau diizinkan.",
  viewer: "Akses baca terhadap data yang diizinkan.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Izin untuk endpoint plugin Organization Better Auth (anggota, undangan, profil organisasi).
 * Izin data bisnis (lead, deal, ...) diatur terpisah dengan CASL di src/lib/abilities.ts.
 */
const ac = createAccessControl(defaultStatements);
const none = ac.newRole({});
export const orgPluginRoles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
  }),
  sales_manager: ac.newRole({ team: ["update"] }),
  sales_rep: none,
  viewer: none,
};
export { ac as orgPluginAc };
