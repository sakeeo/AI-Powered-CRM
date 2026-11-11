import type { Prisma } from "@/generated/prisma/client";
import { scopeWhere } from "@/lib/authz";
import type { TenantContext } from "@/lib/context";
import { normalizePhone } from "@/lib/phone";

export type DuplicateReason = "email" | "phone" | "name_company";
export type DuplicateMatch = {
  entity: "lead" | "contact" | "company";
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  detail: string | null;
  reasons: DuplicateReason[];
  href: string;
};

const eq = (v: string) => ({ equals: v.trim(), mode: "insensitive" as const });
const clean = (v?: string | null) => (v && v.trim() ? v.trim() : undefined);

export type DupInput = {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  companyIds?: string[];
  website?: string;
  excludeId?: string;
};

/** Contact yang mirip: email sama, telepon (dinormalisasi) sama, atau nama sama + company yang sama. */
export async function findContactDuplicates(
  ctx: TenantContext,
  input: DupInput,
): Promise<DuplicateMatch[]> {
  const email = clean(input.email);
  const phone = normalizePhone(input.phone);
  const name = clean(input.name);
  const or: Prisma.ContactWhereInput[] = [];
  if (email) or.push({ email: eq(email) });
  if (phone) or.push({ phoneNormalized: phone });
  if (name && input.companyIds?.length) {
    or.push({ name: eq(name), companies: { some: { companyId: { in: input.companyIds } } } });
  }
  if (!or.length) return [];
  const rows = await ctx.db.contact.findMany({
    where: {
      AND: [
        { deletedAt: null, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
        scopeWhere(ctx, "view", "Contact") as Prisma.ContactWhereInput,
        { OR: or },
      ],
    },
    take: 10,
    include: { companies: { include: { company: { select: { name: true } } } } },
  });
  return rows.map((r) => {
    const reasons: DuplicateReason[] = [];
    if (email && r.email?.toLowerCase() === email.toLowerCase()) reasons.push("email");
    if (phone && r.phoneNormalized === phone) reasons.push("phone");
    if (name && r.name.toLowerCase() === name.toLowerCase() && input.companyIds?.length)
      reasons.push("name_company");
    return {
      entity: "contact" as const,
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      detail: r.companies.map((c) => c.company.name).join(", ") || null,
      reasons,
      href: `/contacts/${r.id}`,
    };
  });
}

/** Lead yang mirip (email, telepon, atau nama + perusahaan sama) — hanya yang boleh dilihat pengguna. */
export async function findLeadDuplicates(
  ctx: TenantContext,
  input: DupInput,
): Promise<DuplicateMatch[]> {
  const email = clean(input.email);
  const phone = normalizePhone(input.phone);
  const name = clean(input.name);
  const company = clean(input.companyName);
  const or: Prisma.LeadWhereInput[] = [];
  if (email) or.push({ email: eq(email) });
  if (phone) or.push({ phoneNormalized: phone });
  if (name && company) or.push({ name: eq(name), companyName: eq(company) });
  if (!or.length) return [];
  const rows = await ctx.db.lead.findMany({
    where: {
      AND: [
        { mergedIntoId: null, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
        scopeWhere(ctx, "view", "Lead") as Prisma.LeadWhereInput,
        { OR: or },
      ],
    },
    take: 10,
  });
  return rows.map((r) => {
    const reasons: DuplicateReason[] = [];
    if (email && r.email?.toLowerCase() === email.toLowerCase()) reasons.push("email");
    if (phone && r.phoneNormalized === phone) reasons.push("phone");
    if (
      name &&
      company &&
      r.name.toLowerCase() === name.toLowerCase() &&
      r.companyName?.toLowerCase() === company.toLowerCase()
    ) {
      reasons.push("name_company");
    }
    return {
      entity: "lead" as const,
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      detail: r.companyName,
      reasons,
      href: `/leads/${r.id}`,
    };
  });
}

const domainOf = (w?: string | null) =>
  w
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] || undefined;

/** Company yang mirip: nama sama (tanpa peduli huruf besar/kecil) atau domain website sama. */
export async function findCompanyDuplicates(
  ctx: TenantContext,
  input: DupInput,
): Promise<DuplicateMatch[]> {
  const name = clean(input.name);
  const domain = domainOf(input.website);
  const or: Prisma.CompanyWhereInput[] = [];
  if (name) or.push({ name: eq(name) });
  if (domain) or.push({ website: { contains: domain, mode: "insensitive" } });
  if (!or.length) return [];
  const rows = await ctx.db.company.findMany({
    where: {
      AND: [
        { deletedAt: null, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
        scopeWhere(ctx, "view", "Company") as Prisma.CompanyWhereInput,
        { OR: or },
      ],
    },
    take: 10,
  });
  return rows.map((r) => ({
    entity: "company" as const,
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    detail: r.website,
    reasons: (name && r.name.toLowerCase() === name.toLowerCase()
      ? ["name_company"]
      : ["email"]) as DuplicateReason[],
    href: `/companies/${r.id}`,
  }));
}

export { domainOf };
