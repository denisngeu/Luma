const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/network-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(80);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,configCalls=0,holdConfig=false,releaseConfig;
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'probe.ts'),"export async function probeCallNetwork(servers,signal){window.__signals.push(signal);return new Promise((resolve,reject)=>{window.__resolveProbe=resolve;signal.addEventListener('abort',()=>reject(new DOMException('Annulé','AbortError')),{once:true});});}");
  writeFileSync(path.join(dir,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Check from '../../app/parametres/call-network-check';window.__signals=[];const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Check/></React.StrictMode>);");
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@/lib/call-network-probe':path.join(dir,'probe.ts'),'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url==='/api/calls'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);assert.equal(p.action,'config','diagnostic never creates a real call');assert.equal(p.id,undefined);configCalls++;
    const finish=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({iceServers:[{urls:'turn:fixture.test'}]}));};if(holdConfig){holdConfig=false;releaseConfig=finish;}else finish();return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  win=new BrowserWindow({width:320,height:740});await win.loadURL('http://127.0.0.1:'+server.address().port);
  const start=()=>win.page.getByRole('button',{name:'Tester la connexion d’appel',exact:true}).click();
  holdConfig=true;await start();await until(()=>!!releaseConfig,'config held');await win.page.getByRole('button',{name:'Annuler le test',exact:true}).click();releaseConfig();releaseConfig=null;await wait(150);assert.equal(await run(win,'window.__signals.length'),0,'cancelled config never starts the transport probe');
  await start();await until(()=>run(win,'window.__signals.length===1'),'probe started');await win.page.getByRole('button',{name:'Annuler le test',exact:true}).click();assert.equal(await run(win,'window.__signals[0].aborted'),true,'cancel signals cleanup');
  await start();await until(()=>run(win,'window.__signals.length===2'),'second probe started');await run(win,"window.__resolveProbe({ok:true,message:'Relais vérifié',relayCandidates:2,errors:[]})");await until(()=>win.page.getByRole('status').getByText('Relais vérifié',{exact:true}).count(),'success shown');
  await start();await until(()=>run(win,'window.__signals.length===3'),'retry started');await run(win,"window.__resolveProbe({ok:false,message:'Transfert indisponible',relayCandidates:2,errors:[403]})");await until(()=>win.page.getByRole('alert').getByText('Transfert indisponible',{exact:true}).count(),'failure shown');
  assert.equal(await run(win,"(()=>{const box=document.querySelector('.settings-network-check').getBoundingClientRect();return box.right<=innerWidth&&box.left>=0;})()"),true,'diagnostic fits a 320px screen');
  await start();await until(()=>run(win,'window.__signals.length===4'),'last probe started');await run(win,'window.__unmount()');assert.equal(await run(win,'window.__signals.at(-1).aborted'),true,'leaving settings cancels the test');assert.equal(configCalls,5);
  console.log('PASS config-only requests, config cancellation, probe cancellation/retry, visible results, mobile layout and unmount cleanup.');
 }catch(error){console.error(error);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),60000);
