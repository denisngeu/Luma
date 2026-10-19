/* Local contact UI scenarios. No account or message is sent to production. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/friends-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,initialFailure=true,holdList=false,pendingList,accepted=false,newRequest=false,acceptCalls=0,requestCalls=0,sessionExpired=false;
const listing=()=>({profile:{code:'my-code',discoverable:1},user:{id:'me',name:'Moi'},items:[{id:'friend-1',sender:'friend',recipient:'me',state:accepted?'accepted':'pending',name:'Mon ami',peer:'friend'},...(newRequest?[{id:'friend-2',sender:'me',recipient:'new',state:'pending',name:'Nouveau contact',peer:'new'}]:[])]});
app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-fake-ui-for-media-stream');app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),"export const usePathname=()=>'/amis';export const useRouter=()=>({push(url){window.__pushed=url;}});");
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import Friends from '../../app/amis/page';
   const original=window.fetch,scenario=new URLSearchParams(location.search).get('case')||'';
   window.fetch=(url,options={})=>original(url,{...options,headers:{...options.headers,'x-test-case':scenario}});
   const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Friends/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},loader:{'.css':'empty'}});
  server=createServer(async(req,res)=>{
   if(req.url==='/api/friends'){
    let body='';for await(const part of req)body+=part;const p=JSON.parse(body),scenario=req.headers['x-test-case'];res.setHeader('Content-Type','application/json');
    if(p.action==='list'){
     if(scenario==='auth'||scenario==='expire'&&sessionExpired){res.statusCode=401;res.end('{"error":"Connexion requise"}');return;}
     if(scenario==='invalid'){res.end('{"profile":null,"items":[]}');return;}
     if(initialFailure){initialFailure=false;res.statusCode=503;res.end('{"error":"Chargement temporairement indisponible."}');return;}
     if(holdList){holdList=false;pendingList={res,data:listing()};return;}
     res.end(JSON.stringify(listing()));return;
    }
    if(p.action==='accept'){acceptCalls++;await wait(150);accepted=true;res.end('{"ok":true}');return;}
    if(p.action==='request'){requestCalls++;if(requestCalls===1){res.statusCode=503;res.end('{"error":"Envoi temporairement indisponible."}');return;}newRequest=true;res.end('{"sent":true,"message":"Demande envoyée."}');return;}
    if(p.action==='chat'){res.end('{"chat":"direct-friend"}');return;}
    res.end('{"ok":true}');return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   const css=['app/themes.css','app/amis/friends.css','app/confidentialite/privacy.css'].map(file=>readFileSync(file,'utf8')).join('\n');
   res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+css+'.friends-page>.social-nav{display:none}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:390,height:844});await win.loadURL(origin+'/amis');
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Chargement temporairement')"),'initial error shown');
  assert.equal(await run(win,"[...document.querySelectorAll('[role=alert] a')].some(a=>a.textContent==='Se connecter')"),false,'network failure does not require sign-in');
  await win.page.getByRole('button',{name:'Réessayer',exact:true}).click();
  await until(()=>run(win,"[...document.querySelectorAll('button')].some(b=>b.textContent==='Accepter')"),'retry loads pending requests');
  holdList=true;await run(win,"window.dispatchEvent(new Event('online'))");await until(()=>!!pendingList,'older refresh in flight');
  await run(win,"const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Accepter');button.click();button.click()");
  await until(()=>run(win,"!!document.querySelector('.contact-tile')"),'accepted contact visible');
  assert.equal(acceptCalls,1,'double click sends one accept');
  if(!pendingList.res.destroyed)pendingList.res.end(JSON.stringify(pendingList.data));
  await run(win,'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await run(win,"!!document.querySelector('.contact-tile')"),true,'older refresh cannot restore a pending request');
  await win.page.getByPlaceholder('nom@exemple.fr').fill('new@example.test');
  await win.page.getByRole('button',{name:'Envoyer une demande dans Luma'}).click();
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Envoi temporairement')"),'request error shown');
  assert.equal(await win.page.getByPlaceholder('nom@exemple.fr').inputValue(),'new@example.test','failed request preserves email');
  await win.page.getByRole('button',{name:'Envoyer une demande dans Luma'}).click();
  await until(()=>run(win,"[...document.querySelectorAll('.friend-row strong')].some(s=>s.textContent==='Nouveau contact')"),'sent request refresh');
  assert.equal(await win.page.getByPlaceholder('nom@exemple.fr').inputValue(),'','successful request clears email');
  await win.page.getByRole('button',{name:'Discuter avec Mon ami',exact:true}).click();await until(()=>run(win,"window.__pushed==='/messages?chat=direct-friend'"),'direct chat navigation');
  await run(win,"window.__capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await window.__capture(c);window.__scan=s;return s;};HTMLVideoElement.prototype.play=()=>Promise.reject(new DOMException('Playback denied','NotAllowedError'));");
  await win.page.getByRole('button',{name:'Scanner un QR code',exact:true}).click();
  await until(()=>run(win,"window.__scan?.getTracks().every(t=>t.readyState==='ended')&&!!document.querySelector('[role=alert]')"),'scanner camera released after playback failure');
  await run(win,"navigator.mediaDevices.getUserMedia=async c=>{const s=await window.__capture(c);window.__lateScan=s;return new Promise(resolve=>{window.__finishScan=()=>resolve(s);});}");
  await win.page.getByRole('button',{name:'Scanner un QR code',exact:true}).click();await until(()=>run(win,'!!window.__finishScan'),'pending scanner capture');
  await run(win,'window.__unmount();window.__finishScan()');
  await until(()=>run(win,"window.__lateScan.getTracks().every(t=>t.readyState==='ended')"),'scanner camera released after navigation');
  await win.loadURL(origin+'/amis?case=auth');await until(()=>run(win,"!!document.querySelector('[role=alert] a[href^=\"/connexion\"]')"),'real authentication failure offers sign-in');
  await win.loadURL(origin+'/amis?case=expire');await until(()=>run(win,"!!document.querySelector('.contact-tile')"),'contacts before session expires');
  sessionExpired=true;await run(win,"window.dispatchEvent(new Event('online'))");
  await until(()=>run(win,"!document.querySelector('.contact-tile')&&!!document.querySelector('[role=alert] a[href^=\"/connexion\"]')"),'expired session clears stale actions and offers sign-in');
  await win.loadURL(origin+'/amis?case=invalid');await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('invalide')"),'invalid data handled without crash');
  console.log('PASS contact loading retry, stale refresh cancellation, duplicate action guard, request retry, direct chat navigation, scanner cleanup and authentication errors.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));}catch{}process.exitCode=1;}
 finally{win?.destroy();if(pendingList&&!pendingList.res.destroyed)pendingList.res.end('{}');server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
