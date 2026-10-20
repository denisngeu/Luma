const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict'),{build}=require('esbuild');
const dir=path.resolve('.sites-runtime/messenger-calls');mkdirSync(dir,{recursive:true});
let server,win,behavior='hold',release;const requests=[];
const run=(code)=>win.webContents.executeJavaScript(code,true);
async function until(check,label){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timeout: '+label);}
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'navigation.ts'),require('./test-navigation-fixture.cjs').replace('location.assign(url);','window.__destination=url;'));
 writeFileSync(path.join(dir,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Messenger from '../../app/messenger';window.fixtureRoot=createRoot(document.getElementById('root'));window.fixtureRoot.render(<React.StrictMode><Messenger/></React.StrictMode>);");
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 const styles=require('./compiled-styles.cjs')();
 server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
   let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);res.setHeader('Content-Type','application/json');
   if(req.url==='/api/chat'){res.end(JSON.stringify(body.action==='list'?{user:{id:'me',name:'Moi'},chats:[{id:'friend-a',name:'Alice',kind:'direct'},{id:'team',name:'Équipe',kind:'group'}]}:{messages:[]}));return;}
   if(body.action==='active'){res.end('{"room":null}');return;}
   requests.push({url:req.url,...body});const finish=()=>res.end(JSON.stringify({id:body.requestId}));
   if(behavior==='hold'){release=()=>{res.statusCode=503;res.end('{"error":"Réponse perdue"}');};return;}
   if(behavior==='hang')return;
   finish();return;
  }
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.end('<html data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style><div id="root"></div><script src="/app.js"></script></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));win=new BrowserWindow({width:390,height:844});await win.loadURL('http://127.0.0.1:'+server.address().port+'/messages');
 const open=async(name)=>{const back=win.page.getByRole('button',{name:'Revenir aux discussions',exact:true});if(await back.isVisible())await back.click();await win.page.getByRole('button',{name:'Ouvrir la discussion avec '+name,exact:true}).click();};
 await until(()=>win.page.getByRole('button',{name:'Ouvrir la discussion avec Alice',exact:true}).count(),'contact list');await open('Alice');
 await run("(()=>{const button=document.querySelector('[aria-label=\"Appel vocal\"]');button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()");
 await until(()=>release,'held call');assert.equal(requests.length,1);assert.equal(await win.page.getByRole('button',{name:'Appel vocal',exact:true}).isEnabled(),false);
 const id=requests[0].requestId;release();await until(()=>win.page.getByText('Réponse perdue',{exact:true}).count(),'visible call error');
 behavior='ok';await win.page.getByRole('button',{name:'Appel vocal',exact:true}).click();await until(()=>run('window.__destination'),'call navigation');assert.equal(await run('window.__destination'),'/appel/'+id);assert.equal(requests.at(-1).requestId,id);
 await run("window.__destination='';window.originalTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.originalTimeout(fn,ms===12000?100:ms,...args)");
 behavior='hang';await win.page.getByRole('button',{name:'Appel vidéo',exact:true}).click();await until(()=>win.page.getByText(/Le serveur met trop de temps/).count(),'timeout visible');assert.equal(await win.page.getByRole('button',{name:'Appel vidéo',exact:true}).isEnabled(),true);
 behavior='ok';await open('Équipe');await win.page.getByRole('button',{name:'Appel vocal',exact:true}).click();await until(()=>run("window.__destination.startsWith('/salle/')"),'group navigation');assert.equal(requests.at(-1).url,'/api/rooms');
 await run('window.setTimeout=window.originalTimeout');behavior='hold';release=null;await open('Alice');await win.page.getByRole('button',{name:'Appel vocal',exact:true}).click();await until(()=>release,'call before unmount');await run("window.__destination='';window.fixtureRoot.unmount()");release();await new Promise(resolve=>setTimeout(resolve,100));assert.equal(await run('window.__destination'),'');
 writeFileSync(path.join(dir,'passed.txt'),'PASS actual Messenger: duplicate click, error recovery, same attempt retry, bounded video timeout, group navigation, unmount cancellation');
 console.log(readFileSync(path.join(dir,'passed.txt'),'utf8'));
}catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.png'),(await win.webContents.capturePage()).toPNG());writeFileSync(path.join(dir,'debug.txt'),await run('document.body.innerText'));}catch{}process.exitCode=1;}
finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
