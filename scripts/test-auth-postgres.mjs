import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/auth-pg';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();await pg.exec(readFileSync('postgres/0001_initial.sql','utf8'));
const driver={query:(s,v)=>pg.query(s,v),async connect(){return driver;}};
globalThis.__authPg={db:new PostgresDatabase(driver),context:new AsyncLocalStorage()};
for(const [name,entry] of [['auth','app/api/auth/route.ts'],['identity','app/chatgpt-auth.ts'],['logout','app/api/auth/logout/route.ts']]){
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
 console.log('PASS: native signup/login/session, cookie protection, wrong password, duplicate email and spoofed identity rejection');
}finally{await pg.close();}
