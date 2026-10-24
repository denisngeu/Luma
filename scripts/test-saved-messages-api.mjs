import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/saved-messages-api';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/db.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/db.mjs'));
const pg=new PGlite();for(const file of readdirSync('postgres').filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pg.exec(readFileSync('postgres/'+file,'utf8'));
const driver={query:(sql,args)=>pg.query(sql,args),async connect(){return driver;}};
globalThis.__savedTest={db:new PostgresDatabase(driver),who:'alice'};
await build({entryPoints:['app/api/chat/route.ts'],outfile:dir+'/route.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'fixture-auth',setup(b){
 b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__savedTest.db;export const getBucket=()=>null;':'export async function getChatGPTUser(){const id=globalThis.__savedTest.who;return id?{userId:id,email:id+"@example.test",fullName:id}:null;}',loader:'js'}));
}}]});
const route=await import(pathToFileURL(process.cwd()+'/'+dir+'/route.mjs'));
async function api(action,extra={},status=200,who='alice'){
 globalThis.__savedTest.who=who;const response=await route.POST(new Request('http://localhost/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({action,...extra})}));const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(action==='saved'&&status===200)assert.match(response.headers.get('Cache-Control'),/private, no-store/);return data;
}
async function message(id,chat='friend-old',author='bob',created=100,scheduled=0,hidden=0){await pg.query('INSERT INTO messages(id,chat,author,body,created,scheduled,hidden) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,chat,author,'Message '+id,created,scheduled,hidden]);await pg.query('INSERT INTO stars(message,"user") VALUES ($1,$2)',[id,'alice']);}
try{
 await pg.exec(`INSERT INTO users(id,name) VALUES ('alice','Alice'),('bob','Bob'),('other','Other');
 INSERT INTO chats(id,name,kind,owner,invite,created) VALUES ('friend-old','Ancien nom','direct','alice','old-invite',1),('group','Groupe','group','alice','group-invite',2),('locked','Locked','group','alice','locked-invite',3),('outsider','Private','group','other','private-invite',4);
 UPDATE chats SET locked=1 WHERE id='locked';
 INSERT INTO members(chat,"user") VALUES ('friend-old','alice'),('friend-old','bob'),('group','alice'),('locked','alice'),('outsider','other');
 INSERT INTO spaces(id,name,owner,invite,created) VALUES ('space','Space','alice','space-invite',1);
 INSERT INTO space_members(space,"user",role) VALUES ('space','alice','owner');
 INSERT INTO chats(id,name,kind,owner,invite,created,space,mode) VALUES ('channel','Channel','channel','alice','channel-invite',1,'space','text');`);
 for(let i=0;i<57;i++)await message('fav-'+String(i).padStart(3,'0'));
 // An old starred message remains retrievable beyond the 200-message history cap.
 for(let i=0;i<205;i++)await pg.query('INSERT INTO messages(id,chat,author,body,created) VALUES ($1,$2,$3,$4,$5)',['later-'+i,'friend-old','bob','Recent',1000+i]);
 await message('group-favorite','group','bob',200);await message('hidden','friend-old','bob',300,0,1);await message('locked-message','locked');await message('foreign','outsider');await message('community','channel');
 await message('future-other','friend-old','bob',400,Date.now()+60000);await message('future-own','friend-old','alice',401,Date.now()+60000);
 await pg.query("UPDATE messages SET body='',file='attachment',filename='document.txt' WHERE id='group-favorite'");
 let next=null,all=[];do{const page=await api('saved',{after:next});assert.ok(page.messages.length<=50);all.push(...page.messages);next=page.next;}while(next);
 assert.equal(all.length,59);assert.equal(new Set(all.map(m=>m.id)).size,59,'no duplicates across tied timestamps');assert.ok(all.some(m=>m.id==='fav-000'),'old favorites outside recent history are present');
 assert.equal(all[0].id,'future-own');assert.equal(all[0].scheduled_pending,1);assert.equal(all.find(m=>m.id==='group-favorite').filename,'document.txt');
 assert.equal(all.find(m=>m.id==='fav-000').chat_name,'Bob','direct-chat title uses current contact identity');
 for(const id of ['hidden','locked-message','foreign','community','future-other'])assert.ok(!all.some(m=>m.id===id),id+' excluded');
 for(const after of [{created:-1,id:'x'},{created:1,id:''},{created:'1',id:'x'},[],true,{created:1,id:'x'.repeat(101)}])await api('saved',{after},400);
 await api('saved',{},401,null);await api('star',{message:'hidden',starred:true},404);await api('star',{message:'foreign',starred:true},404);await api('star',{message:'future-other',starred:true},404);await api('star',{message:'fav-000',starred:'false'},400);
 assert.equal((await api('star',{message:'fav-000',starred:false})).starred,false);assert.equal((await api('star',{message:'fav-000',starred:false})).starred,false);
 assert.equal((await api('star',{message:'fav-000',starred:true})).starred,true);assert.equal((await api('star',{message:'fav-000',starred:true})).starred,true);
 assert.equal((await api('star',{message:'fav-000'})).starred,false,'legacy toggle remains supported');
 await pg.query('DELETE FROM members WHERE chat=$1 AND "user"=$2',['friend-old','alice']);assert.deepEqual((await api('saved')).messages.map(m=>m.id),['group-favorite'],'revoked access removes saved content');
 await pg.query('INSERT INTO members(chat,"user") VALUES ($1,$2)',['friend-old','alice']);
 for(let i=0;i<105;i++){const id='recent-chat-'+i;await pg.query('INSERT INTO chats(id,name,kind,owner,invite,created) VALUES ($1,$1,$2,$3,$1,$4)',[id,'group','alice',10000+i]);await pg.query('INSERT INTO members(chat,"user") VALUES ($1,$2)',[id,'alice']);}
 assert.ok(!(await api('list')).chats.some(c=>c.id==='friend-old'));
 assert.ok((await api('list',{include:'friend-old'})).chats.some(c=>c.id==='friend-old'),'an older favorite can open outside the first 100 discussions');
 for(const id of ['outsider','locked','channel'])assert.ok(!(await api('list',{include:id})).chats.some(c=>c.id===id),'include cannot bypass private-chat ACL');
 console.log('PASS global private/group favorites, stable pagination, old history, attachments, schedule visibility, moderation/lock/membership isolation, idempotent changes, legacy toggles, and opening older discussions.');
}finally{delete globalThis.__savedTest;await pg.close();}
