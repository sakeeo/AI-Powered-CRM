import { logger } from "@/lib/logger";

export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void;

/**
 * Titik integrasi error tracking (mis. Sentry). Default: hanya log terstruktur.
 * Untuk mengaktifkan layanan eksternal, panggil `setErrorReporter(...)` saat startup
 * (dapat dinonaktifkan via env di sisi pemanggil).
 */
let reporter: ErrorReporter = (error, context) => {
  logger.error({ err: error, ...context }, "unhandled error");
};

export function setErrorReporter(next: ErrorReporter) {
  reporter = next;
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  try {
    reporter(error, context);
  } catch (e) {
    logger.error({ err: e }, "error reporter gagal");
  }
}
