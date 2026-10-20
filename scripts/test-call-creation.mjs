import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const dir='.sites-runtime/call-creation';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/db.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/db.mjs'));
const pg=new PGlite();for(const file of readdirSync('postgres').filter(name=>/^\d+.*\.sql$/.test(name)).sort())await pg.exec(readFileSync('postgres/'+file,'utf8'));
const queries=[];const driver={async query(sql,args){queries.push(sql);return pg.query(sql,args);},async connect(){return driver;}};
globalThis.__callCreation={db:new PostgresDatabase(driver),user:null};
for(const name of ['calls','rooms'])await build({entryPoints:['app/api/'+name+'/route.ts'],outfile:dir+'/'+name+'.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'identity-fixture',setup(builder){
 builder.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__callCreation.db;export const getBucket=()=>null;':'export async function getChatGPTUser(){return globalThis.__callCreation.user;}',loader:'js'}));
}}]});
const calls=await import(pathToFileURL(process.cwd()+'/'+dir+'/calls.mjs')),rooms=await import(pathToFileURL(process.cwd()+'/'+dir+'/rooms.mjs'));
async function api(who,body,status=200,route=calls){
 globalThis.__callCreation.user=who?{userId:who,email:who+'@calls.test',fullName:who}:null;
 const response=await route.POST(new Request('http://localhost/api/calls',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify(body)}));
 const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
}
try{
 await pg.exec("INSERT INTO users(id,name) VALUES ('alice','Alice'),('bob','Bob'),('carol','Carol'); INSERT INTO friendships(id,sender,recipient,state,created) VALUES ('ab','alice','bob','accepted',1),('bc','bob','carol','accepted',1);");
 const requestId=randomUUID(),payload={action:'create',peer:'bob',mode:'audio',requestId};
 const first=await api('alice',payload);assert.equal(first.id,requestId);
 assert.equal((await api('alice',payload)).id,first.id,'lost response retry returns the original preparing call');
 assert.equal(Number((await pg.query('SELECT count(*) n FROM calls')).rows[0].n),1);
 await api('alice',{...payload,requestId:randomUUID()},409);
 await api('bob',{...payload,peer:'alice'},409);
 await api('carol',{action:'create',peer:'bob',mode:'audio'},409);
 await api('alice',{...payload,mode:'video'},409);
 await api('alice',{...payload,requestId:'invalid'},400);
 await api('carol',{...payload,peer:'alice'},403);
 await api(null,payload,401);
 for(const state of ['ringing','active','ended']){await pg.query('UPDATE calls SET state=$1 WHERE id=$2',[state,first.id]);await api('alice',payload,409);}
 await pg.query("UPDATE calls SET state='preparing',expires=$1 WHERE id=$2",[Date.now()-1,first.id]);
 const fresh=await api('alice',{...payload,requestId:randomUUID()});assert.notEqual(fresh.id,first.id);
 await pg.exec("INSERT INTO chats(id,name,kind,owner,invite,created) VALUES ('team','Équipe','group','alice','team-invite',1); INSERT INTO members(chat,\"user\") VALUES ('team','alice'),('team','bob');");
 const room=await api('alice',{action:'create',chat:'team',mode:'audio'},200,rooms);
 assert.equal((await api('bob',{action:'create',chat:'team',mode:'audio'},200,rooms)).id,room.id);
 assert.equal(Number((await pg.query('SELECT count(*) n FROM media_rooms')).rows[0].n),1);
 await api('carol',{action:'create',chat:'team'},404,rooms);
 await pg.query("UPDATE media_rooms SET state='ended' WHERE id=$1",[room.id]);
 assert.notEqual((await api('alice',{action:'create',chat:'team'},200,rooms)).id,room.id);
 assert.ok(queries.some(sql=>sql.includes('ORDER BY id FOR UPDATE')),'participant availability is checked under ordered row locks');
 assert.ok(queries.some(sql=>sql==='SELECT id FROM chats WHERE id=$1 FOR UPDATE'),'room creation serializes on its chat');
 console.log('PASS call retries, participant conflicts, expired attempts, room reuse, and access checks (PGlite; no cross-connection concurrency claim)');
}finally{await pg.close();delete globalThis.__callCreation;}
