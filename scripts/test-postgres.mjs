// Actual PostgreSQL engine (PGlite), actual API handlers; identity is mocked only here.
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/postgres-tests';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();await pg.exec(readFileSync('postgres/0001_initial.sql','utf8'));await pg.exec(readFileSync('postgres/0002_admin.sql','utf8'));await pg.exec(readFileSync('postgres/0003_admin_console.sql','utf8'));await pg.exec(readFileSync('postgres/0004_media_rooms.sql','utf8'));
const driver={query:async(sql,args)=>{try{return await pg.query(sql,args);}catch(e){console.error('SQL failed:',sql,e.message);throw e;}},async connect(){return driver;}};
const db=new PostgresDatabase(driver),context=new AsyncLocalStorage(),blobs=new Map();
globalThis.__pgTest={db,context,bucket:{async put(key,body){blobs.set(key,await new Response(body).arrayBuffer());},async get(key){return blobs.has(key)?{body:new Uint8Array(blobs.get(key))}:null;},async delete(key){blobs.delete(key);}}};
const routes={};
for(const route of ['chat','files','community','privacy','friends','calls','social','social-media','rooms']){
 await build({entryPoints:[`app/api/${route}/route.ts`],outfile:dir+'/'+route+'.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-adapters',setup(b){
  b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__pgTest.db;export const getBucket=()=>globalThis.__pgTest.bucket;':`export const nativeAuthEnabled=()=>false;export async function getChatGPTUser(){const h=globalThis.__pgTest.context.getStore(),id=h.get('oai-authenticated-user-id'),email=h.get('oai-authenticated-user-email');return id&&email?{userId:id,email,fullName:null}:null;}`,loader:'js'}));
 }}]});routes[route]=await import(pathToFileURL(process.cwd()+'/'+dir+'/'+route+'.mjs'));
}
const server=createServer(async(req,res)=>{try{const parts=[];for await(const p of req)parts.push(p);const request=new Request('http://127.0.0.1:8788'+req.url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(parts)})});const name=new URL(request.url).pathname.split('/')[2];const response=await context.run(request.headers,()=>routes[name][req.method](request));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Test server failure');}});
await new Promise(resolve=>server.listen(8788,'127.0.0.1',resolve));
try{for(const name of process.argv.slice(2).length?process.argv.slice(2):['chat','community','social','feed','privacy','rooms']){
 writeFileSync(dir+'/run.mjs',readFileSync('scripts/test-'+name+'.mjs','utf8').replaceAll('127.0.0.1:8787','127.0.0.1:8788'));
 const child=spawn(process.execPath,[dir+'/run.mjs'],{stdio:'inherit'});const code=await new Promise(resolve=>child.on('exit',resolve));if(code)throw Error(name+' failed');
}}finally{await new Promise(resolve=>server.close(resolve));await pg.close();}
