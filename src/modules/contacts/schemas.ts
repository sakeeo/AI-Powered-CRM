import { z } from "zod";
import {
  optionalEmail,
  optionalPhone,
  optionalText,
  optionalUrl,
  optionalUuid,
} from "@/lib/schema-helpers";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalText(120),
  address: optionalText(255),
  city: optionalText(80),
  country: optionalText(80),
  notes: optionalText(5000),
  ownerId: optionalUuid,
  companyIds: z.array(z.uuid()).max(20).default([]),
});
export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;
export const updateContactSchema = contactSchema.extend({ id: z.uuid() });

export const companySchema = z.object({
  name: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter").max(160),
  industry: optionalText(100),
  website: optionalUrl,
  email: optionalEmail,
  phone: optionalPhone,
  address: optionalText(255),
  city: optionalText(80),
  country: optionalText(80),
  notes: optionalText(5000),
  ownerId: optionalUuid,
});
export type CompanyInput = z.input<typeof companySchema>;
export type CompanyData = z.output<typeof companySchema>;
export const updateCompanySchema = companySchema.extend({ id: z.uuid() });

export const CONTACT_SORTS = ["name", "email", "createdAt"] as const;
export const COMPANY_SORTS = ["name", "industry", "createdAt"] as const;
