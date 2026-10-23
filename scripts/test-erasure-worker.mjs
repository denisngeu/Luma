import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,writeFile,readFile,mkdir,rmdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {eraseClosedAccountFiles,startErasureWorker} from './erasure-worker.mjs';

const directory=await mkdtemp(path.join(os.tmpdir(),'luma-erasure-test-'));
const pg=new PGlite();const pool={query:(sql,args)=>pg.query(sql,args)};
try{
 await pg.exec('CREATE TABLE users(id text PRIMARY KEY,closed integer);CREATE TABLE erasure_files(key text PRIMARY KEY,"user" text,created bigint);INSERT INTO users VALUES (\'closed\',1),(\'active\',0);');
 const enqueue=(key,user='closed')=>pg.query('INSERT INTO erasure_files VALUES ($1,$2,0)',[key,user]);
 await writeFile(path.join(directory,'owned'),'closed account file');await enqueue('owned');
 await writeFile(path.join(directory,'active-file'),'preserve');await enqueue('active-file','active');
 await enqueue('already-missing');
 await mkdir(path.join(directory,'temporary-failure'));await enqueue('temporary-failure');
 let result=await eraseClosedAccountFiles(pool,directory);assert.deepEqual(result,{removed:2,failed:1});
 assert.equal(await readFile(path.join(directory,'active-file'),'utf8'),'preserve');
 assert.deepEqual((await pg.query('SELECT key FROM erasure_files ORDER BY key')).rows.map(r=>r.key),['active-file','temporary-failure']);
 // Simulate a restart after a storage failure; the durable row is retried.
 await rmdir(path.join(directory,'temporary-failure'));await writeFile(path.join(directory,'temporary-failure'),'retry');
 result=await eraseClosedAccountFiles(pool,directory);assert.deepEqual(result,{removed:1,failed:0});
 await enqueue('../outside');assert.equal((await eraseClosedAccountFiles(pool,directory)).failed,1,'unsafe keys are retained without accessing outside storage');
 await pg.query('DELETE FROM erasure_files WHERE key=$1',['../outside']);
 for(let i=0;i<55;i++)await enqueue('batch-'+i);
 assert.equal((await eraseClosedAccountFiles(pool,directory)).removed,50,'bounded pass');assert.equal((await eraseClosedAccountFiles(pool,directory)).removed,5,'next pass completes remaining batch');
 await enqueue('scheduled');let passes=0;
 const scheduledPool={async query(sql,args){if(sql.startsWith('SELECT'))passes++;return pool.query(sql,args);}};
 const stop=startErasureWorker(scheduledPool,directory,{intervalMs:20,onError:()=>assert.fail('unexpected erasure failure')});
 await new Promise(r=>setTimeout(r,100));stop();const stopped=passes;await new Promise(r=>setTimeout(r,60));assert.equal(passes,stopped,'stop clears retries');
 assert.equal((await pg.query('SELECT 1 FROM erasure_files WHERE key=$1',['scheduled'])).rows.length,0,'automatic pass runs without a user session');
 console.log('PASS durable erasure, storage failure retry, missing-file idempotence, active-account isolation, safe storage paths, bounded batches, automatic retries and stop.');
}finally{await pg.close();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('luma-erasure-test-'));await rm(directory,{recursive:true,force:true});}
