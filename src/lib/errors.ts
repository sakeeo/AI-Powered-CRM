import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { reportError } from "@/lib/error-tracking";

/** Error yang aman ditampilkan ke client. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "bad_request",
  ) {
    super(message);
  }
}

export const NotFoundError = (what = "Data") =>
  new AppError(`${what} tidak ditemukan`, 404, "not_found");
export const ForbiddenError = () => new AppError("Akses ditolak", 403, "forbidden");
export const UnauthorizedError = () => new AppError("Belum login", 401, "unauthorized");

/** Ubah error apa pun menjadi response JSON seragam; error tak terduga dilaporkan & disamarkan. */
export function handleRouteError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Input tidak valid", issues: error.issues } },
      { status: 422 },
    );
  }
  reportError(error, context);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Terjadi kesalahan pada server" } },
    { status: 500 },
  );
}
