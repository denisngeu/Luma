import {DatabaseSync,backup} from 'node:sqlite';
import {readdir,mkdir,readFile,writeFile,copyFile,stat,chmod} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const tables=['users','chats','members','messages','stars','polls','reactions','spaces','space_members','votes','erasure_files','calls','contacts','friendships','posts','post_comments','post_likes','social_profiles','auth_accounts','auth_sessions','auth_rate_limits'];
const quote=s=>'"'+s.replaceAll('"','""')+'"';
async function databases(directory){try{return (await readdir(directory)).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite').map(n=>path.join(directory,n));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

// Run only during cutover, after the old application has stopped writing.
// Source databases and R2 objects are never modified or deleted.
export async function importSqlite(pool,root){
 const candidates=await databases(path.join(root,'v3/d1/miniflare-D1DatabaseObject'));
 if(!candidates.length)return;
 const client=await pool.connect();let source;
 try{
  await client.query('SELECT pg_advisory_lock(726401938)');
  await client.query('CREATE TABLE IF NOT EXISTS luma_imports(name text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now(), counts jsonb NOT NULL)');
  if((await client.query('SELECT 1 FROM luma_imports WHERE name=$1',['sqlite-v1'])).rows.length)return;
  if(process.env.LUMA_MIGRATE_SQLITE!=='1')throw Error('Existing SQLite data detected. Enable LUMA_MIGRATE_SQLITE=1 only during a stopped-writer cutover.');
  if(candidates.length!==1)throw Error('Ambiguous SQLite source; migration stopped');
  source=new DatabaseSync(candidates[0],{readOnly:true});
  const backupDir=path.join(root,'postgres-cutover-backup');await mkdir(backupDir,{recursive:true,mode:0o700});
  const snapshot=path.join(backupDir,'luma-'+Date.now()+'.sqlite');await backup(source,snapshot);await chmod(snapshot,0o600);source.close();source=new DatabaseSync(snapshot,{readOnly:true});
  if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('SQLite integrity check failed');
  if(source.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite foreign key check failed');
  const counts={};
  await client.query('BEGIN');
  for(const table of tables){if(Number((await client.query('SELECT count(*) n FROM '+quote(table))).rows[0].n))throw Error('Target must be empty before import: '+table);}
  for(const table of tables){
   const rows=source.prepare('SELECT * FROM '+quote(table)).all();counts[table]=rows.length;
   for(const row of rows){const columns=Object.keys(row);const values=columns.map(k=>table==='users'&&k==='closed'?0:row[k]);await client.query('INSERT INTO '+quote(table)+'('+columns.map(quote).join(',')+') VALUES('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',values);}
   if(Number((await client.query('SELECT count(*) n FROM '+quote(table))).rows[0].n)!==rows.length)throw Error('Import count mismatch: '+table);
  }
  for(const u of source.prepare('SELECT id,closed FROM users WHERE closed<>0').all())await client.query('UPDATE users SET closed=$1 WHERE id=$2',[u.closed,u.id]);
  const files=source.prepare('SELECT DISTINCT file FROM messages WHERE file IS NOT NULL').all();
  if(files.length){
   const r2paths=await databases(path.join(root,'v3/r2/miniflare-R2BucketObject'));
   if(r2paths.length!==1)throw Error('Ambiguous R2 source');
   const r2=new DatabaseSync(r2paths[0],{readOnly:true});
   try{const uploadDir=process.env.LUMA_UPLOAD_DIRECTORY||path.join(root,'uploads');await mkdir(uploadDir,{recursive:true,mode:0o700});await mkdir(path.join(backupDir,'files'),{recursive:true,mode:0o700});
    for(const {file} of files){
     if(!/^[a-zA-Z0-9_-]{1,100}$/.test(file))throw Error('Unsupported file key');
     const object=r2.prepare('SELECT blob_id,size FROM _mf_objects WHERE key=?').get(file);
     if(!object?.blob_id||! /^[a-zA-Z0-9_-]+$/.test(object.blob_id))throw Error('Missing or multipart R2 object');
     const original=path.join(root,'v3/r2/site-creator-r2/blobs',object.blob_id),bytes=await readFile(original);
     if(bytes.length!==object.size)throw Error('R2 size mismatch');
     const destination=path.join(uploadDir,file);
     try{await stat(destination);if(digest(await readFile(destination))!==digest(bytes))throw Error('Conflicting destination file');}
     catch(e){if(e.code!=='ENOENT')throw e;await copyFile(original,destination);await chmod(destination,0o600);}
     if(digest(await readFile(destination))!==digest(bytes))throw Error('File checksum mismatch');
     await writeFile(path.join(backupDir,'files',file),bytes,{mode:0o600});
    }
   }finally{r2.close();}
  }
  await client.query('INSERT INTO luma_imports(name,counts) VALUES($1,$2)',['sqlite-v1',JSON.stringify(counts)]);
  await client.query('COMMIT');
  console.log('SQLite import verified',counts,'files:',files.length);
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
 finally{source?.close();await client.query('SELECT pg_advisory_unlock(726401938)');client.release();}
}
