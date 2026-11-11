import { z } from "zod";

/** Teks opsional dari form: string kosong/spasi → undefined, selain itu di-trim. */
export const optionalText = (max = 255) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
    z.string().max(max, `Maksimal ${max} karakter`).optional(),
  );

export const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().toLowerCase()) : v),
  z.string().email("Email tidak valid").max(255).optional(),
);

export const optionalPhone = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
  z
    .string()
    .max(30)
    .regex(/^[+\d][\d\s().-]{4,}$/, "Nomor telepon tidak valid")
    .optional(),
);

export const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.uuid().optional(),
);

export const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
  z
    .string()
    .max(255)
    .refine((v) => /^https?:\/\/.+\..+/.test(v) || /^[\w-]+(\.[\w-]+)+/.test(v), "URL tidak valid")
    .optional(),
);

export const idInput = z.object({ id: z.uuid() });
