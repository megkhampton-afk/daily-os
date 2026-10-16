// Runs the Convex backend and the web app together for local development.
// On the first run (no deployment configured yet) this uses Convex's
// no-account local backend, so nothing is hosted and no sign-up is needed.
// Data lives in the .convex folder in this project.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const env = { ...process.env };
const local = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const hasDeployment = /^CONVEX_DEPLOYMENT=/m.test(local) || Boolean(env.CONVEX_DEPLOYMENT);
const hasClientUrl = /^VITE_CONVEX_URL=/m.test(local) || Boolean(env.VITE_CONVEX_URL);

// No deployment configured yet -> let Convex run its anonymous local backend.
if (!hasDeployment) env.CONVEX_AGENT_MODE = "anonymous";

// shell: true because npx is a .cmd shim on Windows; commands are passed as
// single strings because that is the form cmd.exe on Windows parses reliably.
const run = (command) => spawn(command, { stdio: "inherit", env, shell: true });
const stopped = (child) => new Promise((resolve) => child.on("exit", (code) => resolve(code)));

// When either long-running process stops, take the other one down with it.
const stop = (child) => {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") {
    // child.kill() only ends the cmd shim; taskkill takes the whole tree.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
};

// First run: provision the backend and push functions once, so that
// VITE_CONVEX_URL exists in .env.local before Vite starts.
if (!hasClientUrl) {
  console.log("First run: starting the local Convex backend (no account needed)...");
  const code = await stopped(run("npx convex dev --once"));
  if (code !== 0) process.exit(code ?? 1);
}

const convex = run("npx convex dev");
const vite = run("npx vite --open");
convex.on("exit", (code) => {
  stop(vite);
  process.exit(code ?? 0);
});
vite.on("exit", (code) => {
  stop(convex);
  process.exit(code ?? 0);
});
