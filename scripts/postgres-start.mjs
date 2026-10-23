import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {migrate} from './postgres-migrate.mjs';
import {importSqlite} from './import-sqlite.mjs';
import {startErasureWorker} from './erasure-worker.mjs';
if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL before starting Luma');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
pool.on('error',()=>console.error('Account erasure database connection interrupted; retrying.'));
try{await migrate(pool);await importSqlite(pool,process.env.LUMA_LEGACY_DIRECTORY||'/app/.wrangler/state');}catch(error){await pool.end();throw error;}
const stopErasure=startErasureWorker(pool,process.env.LUMA_UPLOAD_DIRECTORY||'/app/.wrangler/state/uploads');
const server=spawn(process.execPath,['.next/standalone/server.js'],{
 stdio:'inherit',
 env:{...process.env,HOSTNAME:'0.0.0.0',PORT:process.env.PORT||'3000'},
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.kill(signal));
server.on('exit',code=>{stopErasure();void pool.end();process.exitCode=code??1;});
server.on('error',()=>{stopErasure();void pool.end();process.exitCode=1;});
