// Starts the TEST-ONLY server for the browser tests with a fresh local database.
import { rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";

const persist = ".wrangler/e2e";
const config = "e2e/wrangler.jsonc";
rmSync(persist, { recursive: true, force: true });
execSync(`npx wrangler d1 migrations apply DB --local -c ${config} --persist-to ${persist}`, { stdio: "inherit" });
const server = spawn("npx", ["wrangler", "dev", "-c", config, "--port", "8788", "--persist-to", persist], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
