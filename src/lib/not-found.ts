import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";

/** Ubah AppError 404 dari query menjadi halaman 404 Next.js (bukan error boundary). */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
