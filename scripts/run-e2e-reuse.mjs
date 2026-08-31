/** Run e2e against an already-running server on port 3000. */
import { execSync } from "node:child_process";

execSync("node scripts/run-e2e.mjs", {
  stdio: "inherit",
  env: { ...process.env, E2E_REUSE_SERVER: "1" },
});
