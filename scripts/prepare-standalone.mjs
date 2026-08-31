import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.warn("No .next/standalone output found; skipping asset copy.");
  process.exit(0);
}

mkdirSync(join(standaloneDir, ".next"), { recursive: true });
cpSync(join(root, ".next", "static"), join(standaloneDir, ".next", "static"), {
  recursive: true,
});

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneDir, "public"), { recursive: true });
}

console.log("Standalone assets copied.");
