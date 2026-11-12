import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Panic Turbopack "task missing in persistent storage" muncul berulang (disk lambat/eksternal).
    // Matikan cache FS dev agar tidak ada state basi antar-run; dev start sedikit lebih lambat.
    turbopackFileSystemCacheForDev: false,
    // Area (app) di-guard session per-pengguna (dinamis by design); validasi instant implisit
    // hanya menghasilkan warning dev yang tidak actionable. Aktifkan per segmen via `export const instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  async headers() {
    // Header keamanan dasar (OWASP). CSP penuh ditunda: Next.js memakai skrip inline; lihat docs/security-review.md.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
