/**
 * Runs Playwright with a managed webServer by default.
 * Clears inherited PLAYWRIGHT_SKIP_WEBSERVER unless E2E_REUSE_SERVER=1.
 */
import { execSync } from "node:child_process";

const env = { ...process.env };

if (env.E2E_REUSE_SERVER === "1") {
  env.PLAYWRIGHT_SKIP_WEBSERVER = "1";
} else {
  delete env.PLAYWRIGHT_SKIP_WEBSERVER;
}

const extraArgs = process.argv.slice(2).join(" ");

execSync(`npx playwright test${extraArgs ? ` ${extraArgs}` : ""}`, { stdio: "inherit", env });
