import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const stateDirectory = path.resolve(
  process.env.LUMA_STATE_DIRECTORY || ".wrangler/state",
);
const migrationStatePath = path.join(stateDirectory, "luma-migrations.json");
const wrangler = path.resolve("node_modules/wrangler/bin/wrangler.js");
const config = "dist/server/wrangler.json";
const migrationsDirectory = path.resolve("drizzle");

mkdirSync(stateDirectory, { recursive: true });

let applied = {};
try {
  applied = JSON.parse(readFileSync(migrationStatePath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const migrations = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const name of migrations) {
  const file = path.join(migrationsDirectory, name);
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");

  if (applied[name]) {
    if (applied[name] !== digest) {
      throw new Error(`La migration deja appliquee ${name} a ete modifiee.`);
    }
    continue;
  }

  console.log(`Application de la migration ${name}`);
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      wrangler,
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      stateDirectory,
      "--file",
      file,
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  applied[name] = digest;
  const temporaryPath = `${migrationStatePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(applied, null, 2)}\n`);
  renameSync(temporaryPath, migrationStatePath);
}

if (process.env.LUMA_MIGRATE_ONLY === "1") process.exit(0);

const server = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    wrangler,
    "dev",
    "--config",
    config,
    "--local",
    "--persist-to",
    stateDirectory,
    "--ip",
    "0.0.0.0",
    "--port",
    process.env.PORT || "3000",
    "--var",
    "LUMA_AUTH_MODE:native",
    "--inspector-port",
    "0",
  ],
  { stdio: "inherit" },
);

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
server.on("exit", (code, signal) => {
  if (signal) console.error(`Serveur arrete par ${signal}`);
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
