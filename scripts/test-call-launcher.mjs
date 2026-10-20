import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const dir='.sites-runtime/call-launcher';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/call-launcher.ts'],outfile:dir+'/launcher.mjs',bundle:true,platform:'node',format:'esm'});
const {createCallLauncher}=await import(pathToFileURL(process.cwd()+'/'+dir+'/launcher.mjs'));
await build({entryPoints:['lib/call-transport.ts'],outfile:dir+'/transport.mjs',bundle:true,platform:'node',format:'esm'});
const {createCallTransport}=await import(pathToFileURL(process.cwd()+'/'+dir+'/transport.mjs'));
const requests=[];let behavior='hold',release;
const server=createServer(async(req,res)=>{
 let raw='';for await(const part of req)raw+=part;
 requests.push({url:req.url,...JSON.parse(raw)});
 const respond=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:requests.at(-1).requestId}));};
 if(behavior==='hold'){release=respond;return;}
 if(behavior==='hang')return;
 if(behavior==='unavailable'){res.writeHead(503);res.end(JSON.stringify({error:'Temporairement indisponible'}));return;}
 if(behavior==='conflict'){res.writeHead(409);res.end(JSON.stringify({error:'Appel en cours'}));return;}
 respond();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,realFetch=globalThis.fetch,realTimer=globalThis.setTimeout;
globalThis.fetch=(url,options)=>realFetch(base+url,options);
const until=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>realTimer(resolve,5));}throw Error('HTTP fixture not reached');};
try{
 const launcher=createCallLauncher(),target={peer:'bob',mode:'audio'};
 const pending=launcher.start(target);assert.equal(await launcher.start(target),null);await until(()=>release);
 assert.equal(requests.length,1,'same-tick duplicate starts issue only one request');assert.equal(launcher.isPending(),true);
 release();assert.match(await pending,/^\/appel\//);assert.equal(launcher.isPending(),false);
 behavior='unavailable';await assert.rejects(launcher.start(target),/Temporairement/);const first=requests.at(-1).requestId;
 behavior='ok';assert.equal(await launcher.start(target),'/appel/'+first,'ambiguous server error retries the same identifier');
 behavior='conflict';await assert.rejects(launcher.start(target),/Appel en cours/);const conflict=requests.at(-1).requestId;
 behavior='ok';await launcher.start(target);assert.notEqual(requests.at(-1).requestId,conflict,'definite rejection starts a fresh attempt');
 behavior='hang';globalThis.setTimeout=(fn,ms,...args)=>realTimer(fn,ms===12000?80:ms,...args);
 await assert.rejects(launcher.start(target),/trop de temps/);assert.equal(launcher.isPending(),false);const timeout=requests.at(-1).requestId;
 behavior='ok';assert.equal(await launcher.start(target),'/appel/'+timeout);
 behavior='hang';const cancelled=launcher.start(target);await until(()=>launcher.isPending());launcher.cancel();await assert.rejects(cancelled,error=>error.name==='AbortError');assert.equal(launcher.isPending(),false);
 behavior='ok';assert.match(await launcher.start({chat:'team',mode:'video',group:true}),/^\/salle\//);assert.equal(requests.at(-1).url,'/api/rooms');
 const transport=createCallTransport('/api/calls',{id:'visit-one'});
 behavior='hang';const outstanding=Promise.allSettled([transport.request('get'),transport.request('config')]);transport.cancel();
 for(const result of await outstanding){assert.equal(result.status,'rejected');assert.equal(result.reason.name,'AbortError');}
 behavior='ok';await transport.request('get');assert.equal(requests.at(-1).id,'visit-one');
 behavior='hang';await assert.rejects(transport.request('get'),/trop de temps/);
 behavior='ok';await transport.request('get');
 console.log('PASS real HTTP duplicate press, ambiguous retry, conflict reset, bounded timeout, cancellation, group navigation');
 console.log('PASS call transport cancels every outstanding request and recovers after a bounded polling timeout');
}finally{globalThis.fetch=realFetch;globalThis.setTimeout=realTimer;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
