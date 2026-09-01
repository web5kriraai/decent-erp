/** Run e2e against an already-running server on port 3000. */
import { execSync } from "node:child_process";

const extraArgs = process.argv.slice(2).join(" ");

execSync(`node scripts/run-e2e.mjs${extraArgs ? ` ${extraArgs}` : ""}`, {
  stdio: "inherit",
  env: { ...process.env, E2E_REUSE_SERVER: "1" },
});
