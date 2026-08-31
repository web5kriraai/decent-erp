/**
 * Stops Next.js dev servers on ports 3000/3001.
 * Required on Windows before `npm run build` — a running dev server locks
 * Prisma's query_engine DLL and causes EPERM during `prisma generate`.
 */
import { execSync } from "node:child_process";

const PORTS = [3000, 3001];

function stopWindowsPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts.at(-1);
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      console.log(`[stop-dev-servers] Stopping PID ${pid} (port ${port})`);
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
    }
  } catch {
    // Nothing listening on this port.
  }
}

function stopUnixPort(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, {
      stdio: "inherit",
      shell: true,
    });
  } catch {
    // Nothing listening on this port.
  }
}

let stopped = 0;
for (const port of PORTS) {
  if (process.platform === "win32") stopWindowsPort(port);
  else stopUnixPort(port);
}

if (process.platform === "win32") {
  // Brief pause so Windows releases file handles before prisma generate runs.
  execSync("powershell -Command \"Start-Sleep -Seconds 1\"", { stdio: "ignore" });
}

console.log("[stop-dev-servers] Ports 3000/3001 cleared.");
