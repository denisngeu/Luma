// Actual PostgreSQL engine and chat handlers; authentication and fixtures are isolated.
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/chat-reads';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();const migrations=readdirSync('postgres').filter(name=>/^\d+.*\.sql$/.test(name)).sort();
for(const name of migrations.filter(name=>name<'0006'))await pg.exec(readFileSync('postgres/'+name,'utf8'));
await pg.exec(`INSERT INTO users(id,name) VALUES ('migration-user','Migration');
 INSERT INTO chats(id,name,kind,owner,invite,created) VALUES ('migration-chat','Historique','group','migration-user','migration-invite',1700000000000);
 INSERT INTO members(chat,"user") VALUES ('migration-chat','migration-user');
 INSERT INTO messages(id,chat,author,body,created,scheduled) VALUES ('migration-message','migration-chat','migration-user','Ancien message conservé',1700000000000,0);`);
for(const name of migrations.filter(name=>name>='0006'))await pg.exec(readFileSync('postgres/'+name,'utf8'));
const migrated=(await pg.query("SELECT body,delivery_seq FROM messages WHERE id='migration-message'")).rows[0];
assert.equal(migrated.body,'Ancien message conservé');assert.ok(Number(migrated.delivery_seq)>0,'migration backfills existing messages without losing content');
const driver={query:(sql,args)=>pg.query(sql,args),async connect(){return driver;}};
globalThis.__chatReadTest={db:new PostgresDatabase(driver),user:null};
await build({entryPoints:['app/api/chat/route.ts'],outfile:dir+'/chat.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-identity',setup(builder){
 builder.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},args=>({path:args.path,namespace:'test'}));
 builder.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__chatReadTest.db;export const getBucket=()=>null;':"export const nativeAuthEnabled=()=>false;export async function getChatGPTUser(){return globalThis.__chatReadTest.user;}",loader:'js'}));
}}]});
const {POST}=await import(pathToFileURL(process.cwd()+'/'+dir+'/chat.mjs'));
async function api(who,action,data={},status=200){
 globalThis.__chatReadTest.user=who?{userId:who,email:who+'@reads.test',fullName:who}:null;
 const response=await POST(new Request('http://localhost/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({action,...data})}));
 const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;
}
async function count(who,chat){return Number((await api(who,'list')).chats.find(item=>item.id===chat).unread);}
try{
 await api(null,'list',{},401);
 const chat=(await api('alice','create',{name:'Lecture réelle',kind:'group'})).id;
 const invite=(await api('alice','list')).chats[0].invite;await api('bob','join',{code:invite});await api('eve','list');
 const time=Date.now()-10000;
 async function message(id,created,author='alice',scheduled=0,hidden=0){await pg.query('INSERT INTO messages(id,chat,author,body,created,scheduled,hidden) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,chat,author,id,created,scheduled,hidden]);}
 await message('first',time);await message('own',time+1,'bob');await message('hidden',time+2,'alice',0,1);
 assert.equal(await count('bob',chat),1,'only visible incoming messages count');
 const snapshot=await api('bob','messages',{chat});assert.equal(await count('bob',chat),1,'fetching a conversation never marks it read by itself');
 await api('eve','read',{chat,cursor:snapshot.readCursor},404);
 await api('bob','read',{chat,cursor:{through:Date.now()+60000,sequence:1}},400);
 await api('bob','read',{chat,cursor:{through:Date.now(),sequence:999999}},409);
 assert.equal((await api('bob','read',{chat,cursor:snapshot.readCursor})).unread,0);
 assert.equal(await count('bob',chat),0);assert.equal(await count('alice',chat),1,'read status is per user');
 // A message arriving in the same millisecond as the snapshot must stay unread.
 await message('same-millisecond',time+1);
 assert.equal(await count('bob',chat),1);
 await api('bob','read',{chat,cursor:snapshot.readCursor});assert.equal(await count('bob',chat),1,'replaying an older snapshot cannot swallow the new boundary message');
 const same=await api('bob','messages',{chat});await api('bob','read',{chat,cursor:same.readCursor});assert.equal(await count('bob',chat),0);
 await api('bob','read',{chat,cursor:snapshot.readCursor});assert.equal(await count('bob',chat),0,'same-snapshot acknowledgements cannot regress');
 assert.deepEqual((await api('bob','messages',{chat})).readCursor,same.readCursor,'idle polls reuse the same read cursor');
 const delivery=Date.now()+2000;await message('scheduled',time-1000,'alice',delivery);
 assert.equal(await count('bob',chat),0,'future delivery is not unread yet');
 const beforeDelivery=await api('alice','messages',{chat});assert.ok(beforeDelivery.messages.some(message=>message.id==='scheduled'&&message.scheduled_pending===1),'author sees an explicitly scheduled preview');
 const scheduledSeq=Number((await pg.query("SELECT delivery_seq FROM messages WHERE id='scheduled'")).rows[0].delivery_seq);assert.ok(beforeDelivery.readCursor.sequence<scheduledSeq,'future author preview cannot advance read sequence');
 await api('bob','read',{chat,cursor:{through:Date.now(),sequence:scheduledSeq}},409);
 await message('after-schedule',Date.now());
 const newerSnapshot=await api('bob','messages',{chat});assert.ok(newerSnapshot.readCursor.sequence>scheduledSeq,'newer visible message advances past future message sequence');
 await api('bob','read',{chat,cursor:newerSnapshot.readCursor});assert.equal(await count('bob',chat),0,'future message remains outside the read snapshot');
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,delivery-Date.now()+30)));
 assert.equal(await count('bob',chat),1,'scheduled delivery becomes unread even though it was created before the read cursor');
 const delivered=(await api('bob','messages',{chat})).messages.at(-1);assert.equal(delivered.id,'scheduled','delayed delivery appears at the end of the conversation');assert.equal(Number(delivered.activity_at),delivery);assert.equal(delivered.scheduled_pending,0);
 assert.equal((await api('bob','list')).chats.find(item=>item.id===chat).preview,'scheduled','preview follows actual delivery time');
 await api('bob','read',{chat,cursor:same.readCursor});assert.equal(await count('bob',chat),1,'delayed older acknowledgement preserves newly delivered message');
 await api('bob','read',{chat,cursor:(await api('bob','messages',{chat})).readCursor});assert.equal(await count('bob',chat),0);
 // The UI has a 200-message window. Opening the latest snapshot also acknowledges older history.
 const bulkTime=Date.now()-500;
 await pg.query("INSERT INTO messages(id,chat,author,body,created,scheduled) SELECT 'bulk-'||n,$1,'alice','Historique', $2::bigint+n,0 FROM generate_series(1,300) n",[chat,bulkTime]);
 // Simulate an imported batch whose messages share one timestamp.
 await pg.query("UPDATE messages SET created=$1 WHERE id LIKE 'bulk-%'",[Date.now()]);
 assert.equal(await count('bob',chat),300);
 let bulk=await api('bob','messages',{chat});assert.equal(bulk.messages.length,200);
 await api('bob','read',{chat,cursor:bulk.readCursor});
 // The server snapshot includes older history without consuming a concurrent new arrival.
 assert.equal(await count('bob',chat),0,'snapshot acknowledges older history beyond the 200-message window');
 await api('bob','read',{chat,cursor:snapshot.readCursor});assert.equal(await count('bob',chat),0,'late acknowledgements never move read cursor backwards');
 const other=(await api('alice','create',{name:'Autre discussion',kind:'group'})).id;
 await new Promise(resolve=>setTimeout(resolve,5));await api('alice','send',{chat,body:'Activité récente'});
 assert.equal((await api('alice','list')).chats[0].id,chat,'latest delivered activity determines conversation order');
 await api('bob','read',{chat:other,cursor:bulk.readCursor},404);
 assert.equal(Number((await pg.query('SELECT count(*) n FROM chat_reads WHERE chat=$1 AND "user"=$2',[chat,'bob'])).rows[0].n),1);
 await pg.query('DELETE FROM members WHERE chat=$1 AND "user"=$2',[chat,'bob']);
 assert.equal(Number((await pg.query('SELECT count(*) n FROM chat_reads WHERE chat=$1 AND "user"=$2',[chat,'bob'])).rows[0].n),0,'membership removal deletes read state');
 await api('bob','read',{chat,cursor:bulk.readCursor},404);
 // An invalid planned date must never become an immediately delivered message.
 const beforeInvalid=Number((await pg.query('SELECT count(*) n FROM messages')).rows[0].n);
 for(const scheduled of ['not-a-date','',null,false,{},[],1.5,-1,Date.now()+367*86400000]){
  await api('alice','send',{chat,body:'Ne pas publier immédiatement',scheduled},400);
 }
 assert.equal(Number((await pg.query('SELECT count(*) n FROM messages')).rows[0].n),beforeInvalid);
 const immediate=await api('alice','send',{chat,body:'Envoi sans programmation'});
 assert.equal(Number((await pg.query('SELECT scheduled FROM messages WHERE id=$1',[immediate.id])).rows[0].scheduled),0);
 const planned=Date.now()+60000;
 const future=await api('alice','send',{chat,body:'Envoi programmé valide',scheduled:planned});
 assert.equal(Number((await pg.query('SELECT scheduled FROM messages WHERE id=$1',[future.id])).rows[0].scheduled),planned);
 console.log('PASS PostgreSQL read persistence, user isolation, visibility, scheduling, boundary races, monotonic acknowledgements, history cutoff, recent activity order and membership removal.');
}finally{await pg.close();delete globalThis.__chatReadTest;}
