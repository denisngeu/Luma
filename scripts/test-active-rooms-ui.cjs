// Real hook in Edge with a controlled clock; HTTP responses are local fixtures.
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/active-rooms');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(50);}throw Error('Timeout '+label);}
let server,win,requests=0,hold=false,release,fail=false,closed=false;
const run=code=>win.webContents.executeJavaScript(code,true);
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useActiveRooms} from '../../hooks/use-active-rooms';
   window.__hidden=false;Object.defineProperty(document,'hidden',{get:()=>window.__hidden});
   window.__now=1700000000000;Date.now=()=>window.__now;
   const originalInterval=window.setInterval;window.setInterval=(fn,delay,...args)=>delay===8000?(window.__tick=fn,7001):originalInterval(fn,delay,...args);
   const originalClear=window.clearInterval;window.clearInterval=id=>id===7001?(window.__tick=null):originalClear(id);
   function Fixture(){const [chats,setChats]=useState([{id:'group',kind:'group',unread:1},{id:'direct',kind:'direct',unread:0}]);window.__chats=setChats;
    const rooms=useActiveRooms(chats);return <pre>{JSON.stringify(rooms)}</pre>;}
   const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<Fixture/>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  server=createServer(async(req,res)=>{
   if(req.url==='/api/rooms'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);assert.equal(p.action,'active');assert.equal(p.chat,'group');requests++;
    const finish=()=>{res.setHeader('Content-Type','application/json');res.statusCode=fail?429:200;res.end(JSON.stringify(fail?{error:'Patientez'}:{room:closed?null:{id:'voice',mode:'audio',participants:2}}));};
    if(hold){release=finish;return;}finish();return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));win=new BrowserWindow({width:390,height:844});
  await win.loadURL('http://127.0.0.1:'+server.address().port);
  await until(()=>run("document.querySelector('pre')?.textContent.includes('voice')"),'first room loaded');assert.equal(requests,1);
  await run("window.__chats(current=>[...current].reverse().map(chat=>({...chat,unread:chat.unread+1})))");await wait(100);
  assert.equal(requests,1,'unread changes and chat ordering do not restart room requests');
  hold=true;await run('window.__now+=8000;window.__tick()');await until(()=>requests===2,'next poll held');
  await run('window.__now+=8000;window.__tick();window.dispatchEvent(new Event("focus"))');await wait(100);assert.equal(requests,2,'slow requests never overlap');
  hold=false;release();await wait(100);
  await run('window.__hidden=true;document.dispatchEvent(new Event("visibilitychange"));window.__now+=16000;window.__tick()');await wait(100);assert.equal(requests,2,'hidden page stops polling');
  await run('window.__hidden=false;document.dispatchEvent(new Event("visibilitychange"))');await until(()=>requests===3,'foreground refresh');await wait(100);
  await run('window.dispatchEvent(new Event("luma-native-background"));window.__now+=16000;window.__tick()');await wait(100);assert.equal(requests,3,'Android background stops polling');
  fail=true;await run('window.dispatchEvent(new Event("luma-native-active"))');await until(()=>requests===4,'resume request');await wait(100);
  await run('window.__now+=8000;window.__tick()');await wait(100);assert.equal(requests,4,'rate limit backs off instead of adding requests');
  fail=false;closed=true;await run('window.__now+=8000;window.__tick()');await until(()=>run("document.querySelector('pre').textContent==='{}'"),'closed room removed');assert.equal(requests,5);
  hold=true;await run('window.__now+=8000;window.__tick()');await until(()=>requests===6,'last request held');
  await run('window.__unmount()');release();await wait(100);assert.equal(await run('window.__tick'),null,'unmount clears poll interval');
  console.log('PASS active rooms: stable group membership, no overlaps, page/native visibility, rate-limit backoff, closed-room removal and unmount cleanup.');
 }catch(error){console.error(error);process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
