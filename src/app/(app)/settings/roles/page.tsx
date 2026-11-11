import type { Metadata } from "next";
import { permissionMatrix } from "@/lib/abilities";
import { requireTenant } from "@/lib/context";
import { ROLES, type Role } from "@/lib/roles";
import { RolesMatrix } from "@/modules/rbac/components/roles-matrix";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function Page() {
  await requireTenant();
  const matrices = Object.fromEntries(ROLES.map((r) => [r, permissionMatrix(r)])) as Record<
    Role,
    ReturnType<typeof permissionMatrix>
  >;
  return <RolesMatrix matrices={matrices} />;
}
