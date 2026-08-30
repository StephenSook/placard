/**
 * End-to-end configuration.
 *
 * The important line is `--enable-features=WebMCP`. Chromium exposes
 * document.modelContext behind it, which means the AGENT SURFACE ITSELF can be
 * exercised headlessly in CI: tool registration, the anticorrelated gate, the
 * hash-bound commit, and the shadow-tool attack. Until this existed those were
 * verified by hand in a browser and asserted in the unit suite only at the
 * source level, which cannot catch a wiring failure between React and the
 * WebMCP runtime.
 *
 * The origin trial token in index.html is bound to the deployed origin and does
 * nothing on localhost. The flag is what makes local and CI runs possible, and
 * it is a different mechanism from the token, so a green run here does NOT
 * prove the token works. That is verified separately against the live origin.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-webmcp",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--enable-features=WebMCP"] },
      },
      // Phone-shaped assertions run in the phone project, at a phone viewport.
      testIgnore: /responsive\.spec\.ts/,
    },
    { name: "phone", use: { ...devices["iPhone 13"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  // Reuse a running preview locally; always start a fresh one in CI.
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
