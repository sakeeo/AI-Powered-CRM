import { z } from "zod";
import { ROLES } from "@/lib/roles";

export const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "EUR", "GBP", "AUD", "JPY"] as const;
export const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Zona waktu tidak valid");

export const organizationProfileSchema = z.object({
  name: z.string().trim().min(2, "Nama organisasi minimal 2 karakter").max(100),
  timezone,
  defaultCurrency: z.enum(CURRENCIES),
  dateFormat: z.enum(DATE_FORMATS),
});
export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

export const onboardingSchema = organizationProfileSchema;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

const assignableRole = z.enum(ROLES);
export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  role: assignableRole,
});
export const changeRoleSchema = z.object({ memberId: z.uuid(), role: assignableRole });
export const setActiveSchema = z.object({ memberId: z.uuid(), active: z.boolean() });
export const idSchema = z.object({ id: z.uuid() });
export const teamSchema = z.object({
  name: z.string().trim().min(2, "Nama tim minimal 2 karakter").max(60),
});
export const renameTeamSchema = teamSchema.extend({ id: z.uuid() });
export const teamMembersSchema = z.object({ teamId: z.uuid(), userIds: z.array(z.uuid()) });

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}
