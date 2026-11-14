import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Session pengguna e2e dibuat sekali di global-setup agar tidak terkena rate limit sign-up.
    storageState: "e2e/.auth/user.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Memakai build production; jalankan `npm run build` lebih dulu (CI melakukannya).
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // E2E mendaftarkan banyak pengguna → pendaftaran publik dibuka.
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}`, PUBLIC_SIGNUP: "true" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
