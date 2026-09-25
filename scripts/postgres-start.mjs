import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {migrate} from './postgres-migrate.mjs';
if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL before starting Luma');
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{await migrate(pool);}finally{await pool.end();}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.kill(signal));
server.on('exit',code=>{process.exitCode=code??1;});
