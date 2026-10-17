// Copies MapLibre's self-contained web worker into public/ so the bundled map can load it
// (setWorkerUrl). Runs before dev and build; the output is generated, not committed.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const outDir = join(here, "..", "public", "vendor");
mkdirSync(outDir, { recursive: true });
copyFileSync(
  join(pkgDir, "dist", "maplibre-gl-worker.mjs"),
  join(outDir, "maplibre-gl-worker.mjs"),
);
console.log(`maplibre-gl ${version} worker → public/vendor/maplibre-gl-worker.mjs`);
