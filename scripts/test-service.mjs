// Exercises the actual API handlers against SQLite with D1/R2-compatible test adapters.
// Cloudflare deployment and device authentication still require integration verification.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_sweet_domino.sql','utf8'));
const blobs=new Map();const context=new AsyncLocalStorage();
const prepare=(sql,args=[])=>({bind:(...values)=>prepare(sql,values),async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
globalThis.__lumaTest={context,env:{DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,body){blobs.set(key,await new Response(body).arrayBuffer());},async get(key){return blobs.has(key)?{body:new Response(blobs.get(key)).body}:null;},async delete(key){blobs.delete(key);}}}};
mkdirSync('.sites-runtime/tests',{recursive:true});
for(const route of ['chat','files'])await build({entryPoints:[`app/api/${route}/route.ts`],outfile:`.sites-runtime/tests/${route}.mjs`,bundle:true,platform:'node',format:'esm',plugins:[{name:'local-adapters',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__lumaTest.env':a.path==='next/headers'?'export async function headers(){return globalThis.__lumaTest.context.getStore()}':'export function redirect(){throw Error("Redirect not supported in API tests")}',loader:'js'}));}}]});
const chat=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/chat.mjs'));const files=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/files.mjs'));
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request('http://127.0.0.1:8788'+req.url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});const result=await context.run(request.headers,()=>req.url.startsWith('/api/files')?(req.method==='GET'?files.GET(request):files.POST(request)):chat.POST(request));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(resolve=>server.listen(8788,'127.0.0.1',resolve));
const testSource=readFileSync('scripts/test-chat.mjs','utf8').replace('127.0.0.1:8787','127.0.0.1:8788');writeFileSync('.sites-runtime/tests/run.mjs',testSource);
const child=spawn(process.execPath,['.sites-runtime/tests/run.mjs'],{stdio:'inherit'});const exit=await new Promise(resolve=>child.on('exit',resolve));await new Promise(resolve=>server.close(resolve));sqlite.close();process.exitCode=exit||0;
