/**
 * Clears ports 3000/3001 before Playwright starts its webServer.
 * Skipped when E2E_REUSE_SERVER=1 (manual server on port 3000).
 */
import { execSync } from "node:child_process";

if (process.env.E2E_REUSE_SERVER === "1") {
  console.log("[pretest:e2e] E2E_REUSE_SERVER=1 — leaving existing servers.");
  process.exit(0);
}

execSync("node scripts/stop-dev-servers.mjs", { stdio: "inherit" });
execSync("npx tsx scripts/reset-e2e-task-state.mjs", { stdio: "inherit" });
