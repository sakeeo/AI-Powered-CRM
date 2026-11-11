import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Email tidak valid");
const password = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(128, "Password maksimal 128 karakter");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password wajib diisi"),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Hanya path internal yang boleh dipakai sebagai tujuan setelah login (cegah open redirect). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email atau password salah.",
  USER_ALREADY_EXISTS: "Email sudah terdaftar.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email sudah terdaftar.",
  EMAIL_NOT_VERIFIED: "Email belum diverifikasi. Periksa kotak masuk Anda.",
  INVALID_TOKEN: "Tautan reset tidak valid atau sudah kedaluwarsa.",
  PASSWORD_TOO_SHORT: "Password minimal 8 karakter.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  if (error?.status === 429) return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  return (error?.code && ERROR_MESSAGES[error.code]) || "Terjadi kesalahan. Silakan coba lagi.";
}
