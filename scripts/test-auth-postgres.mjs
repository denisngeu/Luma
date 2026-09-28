import {grantAdmin} from './grant-admin.mjs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/auth-pg';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();await pg.exec(readFileSync('postgres/0001_initial.sql','utf8'));await pg.exec(readFileSync('postgres/0002_admin.sql','utf8'));await pg.exec(readFileSync('postgres/0003_admin_console.sql','utf8'));await pg.exec(readFileSync('postgres/0004_media_rooms.sql','utf8'));
const driver={query:(s,v)=>pg.query(s,v),async connect(){return driver;}};
globalThis.__authPg={db:new PostgresDatabase(driver),context:new AsyncLocalStorage()};
for(const [name,entry] of [['auth','app/api/auth/route.ts'],['identity','app/chatgpt-auth.ts'],['logout','app/api/auth/logout/route.ts'],['admin','lib/admin.ts']]){
 await build({entryPoints:[entry],outfile:dir+'/'+name+'.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-runtime',setup(b){b.onResolve({filter:/^(@\/lib\/runtime|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='@/lib/runtime'?'export const getDatabase=()=>globalThis.__authPg.db':a.path==='next/headers'?'export async function headers(){return globalThis.__authPg.context.getStore()}':'export function redirect(){throw Error("redirect")}',loader:'js'}));}}]});
}
const auth=await import(pathToFileURL(process.cwd()+'/'+dir+'/auth.mjs')),identity=await import(pathToFileURL(process.cwd()+'/'+dir+'/identity.mjs'));
const post=body=>auth.POST(new Request('https://luma.example/api/auth',{method:'POST',headers:{'content-type':'application/json',origin:'https://luma.example'},body:JSON.stringify(body)}));
try{
 const account={email:'alice@example.test',password:'LocalTestOnly-123!',name:'Alice'};
 const registered=await post({action:'register',...account});assert.equal(registered.status,200);
 const cookie=registered.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);
 const current=await globalThis.__authPg.context.run(new Headers({cookie}),()=>identity.getChatGPTUser());assert.equal(current.email,account.email);
 assert.equal((await post({action:'login',...account,password:'WrongPassword123'})).status,401);
 assert.equal((await post({action:'login',...account})).status,200);
 assert.equal((await post({action:'register',...account})).status,409);
 assert.equal(await globalThis.__authPg.context.run(new Headers({'oai-authenticated-user-id':'fake','oai-authenticated-user-email':account.email}),()=>identity.getChatGPTUser()),null);
 const admin=await import(pathToFileURL(process.cwd()+'/'+dir+'/admin.mjs'));
 assert.equal(await admin.isAdministrator(current.userId),false);
 await pg.query('UPDATE users SET suspended=1 WHERE id=$1',[current.userId]);
 assert.equal(await globalThis.__authPg.context.run(new Headers({cookie}),()=>identity.getChatGPTUser()),null);
 assert.equal((await post({action:'login',...account})).status,401);
 await pg.query('UPDATE users SET suspended=0 WHERE id=$1',[current.userId]);
 await pg.query('UPDATE service_settings SET registrations_open=0 WHERE id=1');
 assert.equal((await post({action:'register',...account,email:'new@example.test'})).status,403);
 await pg.query('UPDATE service_settings SET registrations_open=1 WHERE id=1');
 await assert.rejects(grantAdmin(driver,'missing@example.test'),/not found/);
 await grantAdmin(driver,account.email);assert.equal(await admin.isAdministrator(current.userId),true);
 await assert.rejects(pg.query('UPDATE users SET closed=1 WHERE id=$1',[current.userId]),/last active administrator/);
 await pg.query("INSERT INTO users(id,name,role) VALUES('backup-admin','Backup','admin')");
 await pg.query('UPDATE users SET closed=1 WHERE id=$1',[current.userId]);assert.equal(await admin.isAdministrator(current.userId),false);
 console.log('PASS: admin assignment, default denial, closed account rejection; native signup/login/session, cookie protection, wrong password, duplicate email and spoofed identity rejection');
}finally{await pg.close();}
