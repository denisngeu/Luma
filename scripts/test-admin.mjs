import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/admin-tests';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();for(const name of readdirSync('postgres').filter(n=>n.endsWith('.sql')).sort())await pg.exec(readFileSync('postgres/'+name,'utf8'));
const driver={query:async(s,v)=>{try{return await pg.query(s,v);}catch(e){console.error('Test SQL failure:',s,e.message);throw e;}},async connect(){return driver;}};
globalThis.__adminTest={db:new PostgresDatabase(driver),id:'owner',bucket:{async get(){return {body:new Uint8Array([1])}}}};
const routes={};
for(const name of ['admin','chat','community','files','social','reports','calls']){
 await build({entryPoints:[`app/api/${name}/route.ts`],outfile:dir+'/'+name+'.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test',setup(b){
 b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__adminTest.db;export const getBucket=()=>globalThis.__adminTest.bucket;':`export async function getChatGPTUser(){const id=globalThis.__adminTest.id;return id?{userId:id,email:id+'@test.invalid',fullName:id}:null;}`,loader:'js'}));
 }}]});routes[name]=await import(pathToFileURL(process.cwd()+'/'+dir+'/'+name+'.mjs'));
}
const request=(route,p,method='POST',origin='https://luma.test')=>routes[route][method](new Request('https://luma.test/api/'+route+(method==='GET'?p:''),{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(p)}:{})}));
const act=(action,target,extra={})=>request('admin',{action,target,reason:'Test de modération',...extra});
const ok=async r=>{assert.equal(r.status,200,await r.clone().text());return r.json();};
try{
 await pg.exec(`INSERT INTO users(id,name,role) VALUES('owner','Owner','admin'),('alice','Alice','user'),('bob','Bob','user');INSERT INTO chats(id,name,kind,owner,invite,created) VALUES('chat','Groupe','group','alice','invite',1);INSERT INTO members(chat,"user") VALUES('chat','alice'),('chat','bob');INSERT INTO messages(id,chat,author,body,created,file,filename) VALUES('msg','chat','alice','Secret signalé',1,'file','test.txt');INSERT INTO posts(id,author,body,created) VALUES('post','alice','Publication',1);INSERT INTO spaces(id,name,owner,invite,created) VALUES('space','Communauté','alice','space-invite',1);INSERT INTO space_members(space,"user",role) VALUES('space','alice','owner');INSERT INTO auth_sessions(token_hash,"user",created,expires) VALUES('session','alice',1,9999999999999);`);
 globalThis.__adminTest.id=null;assert.equal((await request('admin','','GET')).status,401);
 globalThis.__adminTest.id='alice';assert.equal((await request('admin','','GET')).status,403);assert.equal((await act('suspend','bob')).status,403);
 globalThis.__adminTest.id='owner';assert.equal((await request('admin',{action:'suspend',target:'bob',reason:'valid reason'},'POST','https://evil.test')).status,403);
 assert.equal((await act('suspend','owner')).status,409);assert.equal((await act('role','owner',{value:'user'})).status,409);assert.equal((await act('role','alice',{value:'root'})).status,400);
 for(const section of ['overview','users','spaces','chats','calls','reports','audit','settings'])await ok(await request('admin','?section='+section,'GET'));
 await ok(await act('suspend','alice'));assert.equal((await pg.query('SELECT count(*) n FROM auth_sessions')).rows[0].n,0);
 globalThis.__adminTest.id='alice';assert.equal((await request('chat',{action:'send',chat:'chat',body:'blocked'})).status,403);
 globalThis.__adminTest.id='owner';await ok(await act('restore_user','alice'));await ok(await act('lock_chat','chat',{value:true}));
 globalThis.__adminTest.id='alice';assert.equal((await request('chat',{action:'messages',chat:'chat'})).status,404);
 globalThis.__adminTest.id='owner';await ok(await act('lock_chat','chat',{value:false}));
 globalThis.__adminTest.id='bob';await ok(await request('reports',{kind:'message',target:'msg',reason:'Message à examiner pour abus'}));assert.equal((await request('reports',{kind:'message',target:'msg',reason:'Même message déjà signalé'})).status,409);
 globalThis.__adminTest.id='owner';assert.equal((await request('reports',{kind:'message',target:'msg',reason:'Pas membre de cette conversation'})).status,404);
 const reports=await ok(await request('admin','?section=reports','GET'));assert.equal(reports.items[0].content,'Secret signalé');
 await ok(await act('moderate','msg',{kind:'message',value:true}));
 globalThis.__adminTest.id='bob';const feed=await ok(await request('chat',{action:'messages',chat:'chat'}));assert.equal(feed.messages.length,0);assert.equal((await request('files','?id=file','GET')).status,404);
 globalThis.__adminTest.id='owner';await ok(await act('moderate','msg',{kind:'message',value:false}));await ok(await act('resolve_report',reports.items[0].id,{value:'resolved'}));
 await ok(await act('moderate','post',{kind:'post',value:true}));globalThis.__adminTest.id='alice';assert.equal((await ok(await request('social',{action:'feed'}))).items.length,0);
 globalThis.__adminTest.id='owner';await ok(await act('lock_space','space',{value:true}));globalThis.__adminTest.id='alice';assert.equal((await request('community',{action:'space',space:'space'})).status,404);
 globalThis.__adminTest.id='owner';await ok(await act('settings','service',{registrations_open:false,calls_open:false}));globalThis.__adminTest.id='bob';assert.equal((await request('calls',{action:'create',peer:'alice'})).status,403);
 globalThis.__adminTest.id='owner';const log=await ok(await request('admin','?section=audit','GET'));assert.ok(log.items.length>=10);assert.ok(log.items.every(r=>r.actor==='owner'&&r.reason));
 const count=(await pg.query('SELECT count(*) n FROM admin_audit')).rows[0].n;assert.equal((await act('suspend','missing')).status,404);assert.equal((await pg.query('SELECT count(*) n FROM admin_audit')).rows[0].n,count);
 console.log('PASS: admin authorization, CSRF, self protection, suspension, revocation, locks, scoped reports, duplicate reports, reversible moderation, hidden attachments, call switch, transactional audit and all dashboard sections');
}finally{await pg.close();}
