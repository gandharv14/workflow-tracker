import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const storeFile = join(process.cwd(), "test-results", "e2e-people.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      WORKFLOW_TRACKER_STORE: "file",
      WORKFLOW_TRACKER_STORE_FILE: storeFile,
      PORT: String(port),
    },
  },
});
