import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/active-room-batch';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/db.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/db.mjs'));
const pg=new PGlite();for(const file of readdirSync('postgres').filter(name=>/^\d+.*\.sql$/.test(name)).sort())await pg.exec(readFileSync('postgres/'+file,'utf8'));
const queries=[];const driver={async query(sql,args){queries.push(sql);return pg.query(sql,args);},async connect(){return driver;}};
globalThis.__activeRoomBatch={db:new PostgresDatabase(driver),user:null};
await build({entryPoints:['app/api/rooms/route.ts'],outfile:dir+'/route.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'local-identity',setup(b){
 b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__activeRoomBatch.db;export const getBucket=()=>null;':'export async function getChatGPTUser(){return globalThis.__activeRoomBatch.user;}',loader:'js'}));
}}]});
const route=await import(pathToFileURL(process.cwd()+'/'+dir+'/route.mjs'));
async function api(who,chats,status=200){
 globalThis.__activeRoomBatch.user=who?{userId:who,email:who+'@batch.test',fullName:who}:null;
 const result=await route.POST(new Request('http://localhost/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({action:'active_many',chats})}));
 const data=await result.json();assert.equal(result.status,status,JSON.stringify(data));return data;
}
try{
 await pg.exec(`INSERT INTO users(id,name) VALUES ('owner','Owner'),('member','Member'),('outsider','Outsider');
 INSERT INTO spaces(id,name,owner,invite,created) VALUES ('space','Space','owner','invite',1);
 INSERT INTO space_members(space,"user",role) VALUES ('space','owner','owner'),('space','member','member');
 INSERT INTO chats(id,name,kind,owner,invite,created,space,mode) VALUES ('group','Group','group','owner','group-invite',1,NULL,'text'),('voice','Voice','channel','owner','voice-invite',1,'space','voice'),('quiet','Quiet','channel','owner','quiet-invite',1,'space','voice');
 INSERT INTO members(chat,"user") VALUES ('group','owner'),('group','member');`);
 const now=Date.now();
 for(const [id,chat,state,created,expires] of [['old','group','open',now-10000,now+60000],['latest','group','open',now-1000,now+60000],['voice-room','voice','open',now,now+60000],['expired','quiet','open',now-60000,now-1],['ended','quiet','ended',now,now+60000]])await pg.query('INSERT INTO media_rooms(id,chat,creator,kind,mode,state,created,expires) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[id,chat,'owner',chat==='group'?'group':'voice','audio',state,created,expires]);
 await pg.query('INSERT INTO media_participants(room,"user",joined,last_seen) VALUES ($1,$2,$3,$4),($1,$5,$3,$6)',['latest','owner',now,now,'member',now-60000]);
 const before=queries.length,result=await api('member',['group','voice','quiet']);
 assert.equal(result.rooms.group.id,'latest');assert.equal(result.rooms.group.participants,1);assert.equal(result.rooms.voice.id,'voice-room');assert.equal(result.rooms.quiet,null);
 assert.equal(queries.slice(before).filter(sql=>sql.includes('LEFT JOIN LATERAL')).length,1,'one query resolves all authorized rooms');
 assert.deepEqual((await api('member',['voice','voice'])).rooms,{voice:result.rooms.voice});
 for(const invalid of [undefined,[],{},'voice',Array(51).fill('voice'),['']])await api('member',invalid,400);
 await api(null,['voice'],401);await api('outsider',['voice'],404);await api('member',['voice','unknown'],404);
 await pg.query("UPDATE chats SET locked=1 WHERE id='voice'");await api('member',['voice'],404);await pg.query("UPDATE chats SET locked=0 WHERE id='voice'");
 await pg.query("UPDATE spaces SET locked=1 WHERE id='space'");await api('member',['voice'],404);await pg.query("UPDATE spaces SET locked=0 WHERE id='space'");
 await pg.query('DELETE FROM space_members WHERE space=$1 AND "user"=$2',['space','member']);await api('member',['voice'],404);
 await pg.query('DELETE FROM members WHERE chat=$1 AND "user"=$2',['group','member']);await api('member',['group'],404);
 console.log('PASS active-room batching, newest/open selection, live presence, private/community ACLs, locks, revoked access, input limits and authentication.');
}finally{await pg.close();delete globalThis.__activeRoomBatch;}
