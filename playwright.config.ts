import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
