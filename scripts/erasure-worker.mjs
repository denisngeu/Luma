import {unlink} from 'node:fs/promises';
import path from 'node:path';

// Only process durable erasure requests belonging to already closed accounts.
// Keep failed rows for the next pass, including after a server restart.
export async function eraseClosedAccountFiles(pool,directory){
 const {rows}=await pool.query('SELECT e.key,e."user" FROM erasure_files e JOIN users u ON u.id=e."user" WHERE u.closed=1 ORDER BY e.created,e.key LIMIT 50');
 let removed=0,failed=0;
 for(const row of rows){
  try{
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(row.key))throw Error('Invalid storage key');
   try{await unlink(path.join(directory,row.key));}catch(error){if(error.code!=='ENOENT')throw error;}
   await pool.query('DELETE FROM erasure_files WHERE key=$1 AND "user"=$2 AND EXISTS(SELECT 1 FROM users WHERE id=$2 AND closed=1)',[row.key,row.user]);
   removed++;
  }catch{
   failed++;
   // A permanently failing file must not starve later requests.
   await pool.query('UPDATE erasure_files SET created=$1 WHERE key=$2 AND "user"=$3',[Date.now(),row.key,row.user]);
  }
 }
 return {removed,failed};
}

export function startErasureWorker(pool,directory,{intervalMs=30000,onError=()=>console.error('Account file erasure will be retried.')}={}){
 let running=false,stopped=false;
 const tick=async()=>{
  if(running||stopped)return;
  running=true;
  try{const result=await eraseClosedAccountFiles(pool,directory);if(result.failed)onError();}
  catch{onError();}finally{running=false;}
 };
 const timer=setInterval(()=>void tick(),intervalMs);timer.unref();void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
