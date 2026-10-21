// Local-first launcher. An explicitly configured deployment is left unchanged.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const env = { ...process.env };
const local = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const hasDeployment = /^CONVEX_DEPLOYMENT=/m.test(local) || Boolean(env.CONVEX_DEPLOYMENT);
const hasClientUrl = /^VITE_CONVEX_URL=/m.test(local) || Boolean(env.VITE_CONVEX_URL);
if (!hasDeployment) env.CONVEX_AGENT_MODE = "anonymous";

// Static shell commands also work through Windows' npx.cmd shim.
const run = (command) => spawn(command, { stdio: "inherit", env, shell: true });
const stopped = (child) => new Promise((resolve) => child.on("exit", (code) => resolve(code)));
const stop = (child) => {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
};

if (!hasClientUrl) {
  console.log("First run: starting the local Convex backend (no account needed)...");
  const code = await stopped(run("npx convex dev --once"));
  if (code !== 0) process.exit(code ?? 1);
}

const convex = run("npx convex dev");
// Keep the frontend origin stable for OAuth redirects and passcode storage.
const vite = run("npx vite --host localhost --port 5173 --strictPort --open");
let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  stop(vite);
  stop(convex);
  process.exit(code);
}
process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
convex.on("exit", (code) => shutdown(code ?? 0));
vite.on("exit", (code) => shutdown(code ?? 0));
