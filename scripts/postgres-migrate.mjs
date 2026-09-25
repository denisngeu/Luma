import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function migrate(pool){
 const c=await pool.connect();
 try{
  await c.query('SELECT pg_advisory_lock(726401937)');
  await c.query('CREATE TABLE IF NOT EXISTS luma_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir(new URL('../postgres/',import.meta.url))).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
   const sql=await readFile(new URL('../postgres/'+name,import.meta.url),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
   const prior=await c.query('SELECT checksum FROM luma_migrations WHERE name=$1',[name]);
   if(prior.rows.length){if(prior.rows[0].checksum!==checksum)throw Error('Migration modified after application: '+name);continue;}
   await c.query('BEGIN');
   try{await c.query(sql);await c.query('INSERT INTO luma_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await c.query('COMMIT');console.log('Applied '+name);}
   catch(e){await c.query('ROLLBACK');throw e;}
  }
 }finally{await c.query('SELECT pg_advisory_unlock(726401937)');c.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{await migrate(pool);}finally{await pool.end();}
}
