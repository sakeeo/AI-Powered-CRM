import pino from "pino";

/** Field yang tidak boleh muncul di log (password, token, API key, cookie, dll). */
export const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "authorization",
  "cookie",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
      base: { service: "crm" },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export const logger = createLogger();

/** Logger anak dengan request id (ambil dari header `x-request-id` atau buat baru). */
export function requestLogger(req?: Request) {
  const requestId = req?.headers.get("x-request-id") ?? crypto.randomUUID();
  return { requestId, log: logger.child({ requestId }) };
}
