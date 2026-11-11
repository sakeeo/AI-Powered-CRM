import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  // Isolasi tenant (docs/database.md): kode modul bisnis WAJIB memakai ctx.db (forTenant),
  // bukan prisma mentah. Hanya modul "akar tenant" (organisasi, audit) yang boleh karena
  // mengelola data lintas-organisasi milik pengguna (keanggotaan, profil org).
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    ignores: ["src/modules/organizations/**", "src/modules/audit/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Gunakan ctx.db (forTenant) dari requireTenant()/tenantAction. Prisma mentah tidak ter-scope per tenant.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
