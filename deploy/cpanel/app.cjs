/**
 * Passenger startup file for cPanel "Setup Node.js App" (docs/DEPLOYMENT.md, ADR-012).
 *
 * Lives in the application root, outside the releases; activate.sh copies it from each release.
 * It loads the environment file, then starts the standalone Next.js server of the release that
 * `current` points to. CommonJS on purpose: Passenger `require()`s the startup file.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS by design (see above) */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;
const envFile = path.join(root, ".env.production");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// Encrypted documents (FR-DOC-008) live outside the releases and survive every deploy. The
// standalone server chdirs into the release, so a relative path would point inside it.
process.env.STORAGE_DIR ||= path.join(root, "shared", "storage");

// CloudLinux sets HOSTNAME to the machine name and Next.js would bind to it. "localhost", not
// 127.0.0.1: the proxy (middleware) builds internal URLs with localhost, and a different host
// makes Next treat its own rewrites as external (500 on every page).
process.env.HOSTNAME = "localhost";

// activate.sh restarts the app by stopping these processes: LiteSpeed's lsnode ignores
// tmp/restart.txt here, and Next renames the process ("next-server"), so it can't be found by name.
const pids = path.join(root, "tmp", "pids");
const pidFile = path.join(pids, String(process.pid));
try {
  fs.mkdirSync(pids, { recursive: true });
  fs.writeFileSync(pidFile, "");
  process.on("exit", () => fs.rmSync(pidFile, { force: true }));
} catch (err) {
  console.error("[app.cjs] Could not record the process id", err);
}

const server = path.join(fs.realpathSync(path.join(root, "current")), "apps", "web", "server.js");
import(pathToFileURL(server).href).catch((err) => {
  console.error("[app.cjs] Could not start", server, err);
  process.exit(1);
});
