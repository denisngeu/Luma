import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from './postgres-migrate.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const dataDir = path.join(projectRoot, '.sites-runtime', 'pgdata');
const uploadsDir = path.join(projectRoot, '.sites-runtime', 'uploads');

mkdirSync(dataDir, { recursive: true });
mkdirSync(uploadsDir, { recursive: true });

console.log('[Luma Local] Démarrage de la base de données PostgreSQL (PGlite)...');
const db = new PGlite(dataDir);
const port = 5432;
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 50 });
await server.start();
console.log(`[Luma Local] Base de données prête sur 127.0.0.1:${port}`);

const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/luma`;
process.env.DATABASE_URL = databaseUrl;
process.env.LUMA_UPLOAD_DIRECTORY = uploadsDir;
process.env.LUMA_ICE_SERVERS = '[]';

console.log('[Luma Local] Application des migrations PostgreSQL...');
const pool = new Pool({ connectionString: databaseUrl });
try {
  await migrate(pool);
  console.log('[Luma Local] Migrations appliquées avec succès.');
} catch (err) {
  console.error('[Luma Local] Erreur lors des migrations:', err);
} finally {
  await pool.end();
}

console.log('[Luma Local] Lancement du serveur Next.js sur http://localhost:5173...');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '--port', '5173'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    LUMA_UPLOAD_DIRECTORY: uploadsDir,
    LUMA_ICE_SERVERS: '[]',
  },
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\n[Luma Local] Arrêt en cours (${sig})...`);
    child.kill(sig);
    try {
      await server.stop();
    } catch {}
    process.exit(0);
  });
}

child.on('exit', async (code) => {
  try {
    await server.stop();
  } catch {}
  process.exit(code ?? 0);
});
