import { defineConfig, devices } from "@playwright/test";

// One tag per run so the teardown can delete exactly what this run created.
process.env.RUN_TAG ||= `e2e-${process.env.GITHUB_RUN_ID ?? Date.now()}`;

const PORT = process.env.PORT ?? "3000";
const EXTERNAL = process.env.BASE_URL && process.env.BASE_URL.trim() !== "";
const baseURL = EXTERNAL ? process.env.BASE_URL! : `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Demo mode shares a single account, so run serially to avoid interference.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: the journey is serial and creates data, so a retry would
  // re-run from scratch and duplicate the tagged pet. A clean single failure
  // is easier to diagnose (teardown still cleans up by RUN_TAG either way).
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Local sandboxes can point at a pre-installed Chromium; CI installs its own.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  // Start the built app unless we're pointed at an external BASE_URL.
  webServer: EXTERNAL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
