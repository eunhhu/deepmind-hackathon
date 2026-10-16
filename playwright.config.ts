import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
  },
});
